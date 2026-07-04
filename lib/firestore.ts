import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  type Unsubscribe,
  updateDoc,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadString,
} from 'firebase/storage';
import type { Novel } from '@/types';
import { db, storage } from './firebase';
import type { PromptTemplateKey } from './prompts';

// ── Collections ──────────────────────────────────────────────────
const NOVELS = 'novels';
const PROMPT_TEMPLATES = 'promptTemplates';

// ── Novel CRUD ───────────────────────────────────────────────────

export async function fetchNovels(): Promise<Novel[]> {
  const snap = await getDocs(
    query(collection(db, NOVELS), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map((d) => d.data() as Novel);
}

export function subscribeNovels(cb: (novels: Novel[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, NOVELS), orderBy('createdAt', 'desc')),
    (snap) => cb(snap.docs.map((d) => d.data() as Novel))
  );
}

// Remove undefined fields recursively (Firestore doesn't accept undefined)
function stripUndefined(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefined(v)])
    );
  }
  return obj;
}

export async function saveNovel(novel: Novel): Promise<void> {
  const toSave = stripUndefined({
    ...novel,
    styleRefImages: undefined,
    characters: novel.characters.map((c) => ({
      ...c,
      imageBase64: undefined,
      imageMime: undefined,
    })),
    parts: novel.parts.map((p) => ({
      ...p,
      discussionQuestions: p.discussionQuestions.map((dq) => ({
        ...dq,
        sceneImage: undefined,
        sceneMime: undefined,
      })),
    })),
  });
  await setDoc(doc(db, NOVELS, novel.id), toSave);
}

export async function updateNovelField(
  novelId: string,
  data: Partial<Novel>
): Promise<void> {
  await updateDoc(doc(db, NOVELS, novelId), data as Record<string, unknown>);
}

export async function deleteNovel(novelId: string): Promise<void> {
  await deleteDoc(doc(db, NOVELS, novelId));
}

// ── Image Storage ─────────────────────────────────────────────────

// Upload base64 image to Firebase Storage, return download URL
export async function uploadImage(
  path: string,
  base64: string,
  mimeType: string
): Promise<string> {
  const storageRef = ref(storage, path);
  await uploadString(
    storageRef,
    `data:${mimeType};base64,${base64}`,
    'data_url'
  );
  return getDownloadURL(storageRef);
}

export async function deleteImage(path: string): Promise<void> {
  try {
    await deleteObject(ref(storage, path));
  } catch {
    // Ignore if file doesn't exist
  }
}

// Upload character image and update novel in Firestore
export async function saveCharacterImage(
  novel: Novel,
  charId: string,
  base64: string,
  mimeType: string
): Promise<string> {
  const path = `novels/${novel.id}/characters/${charId}`;
  const url = await uploadImage(path, base64, mimeType);

  // Update character imageUrl in Firestore
  const updatedChars = novel.characters.map((c) =>
    c.id === charId ? { ...c, imageUrl: url, imageBase64: undefined } : c
  );
  await updateDoc(doc(db, NOVELS, novel.id), { characters: updatedChars });
  return url;
}

// Upload scene image and update DQ in Firestore
export async function saveSceneImage(
  novel: Novel,
  partId: string,
  dqId: string,
  base64: string,
  mimeType: string
): Promise<string> {
  const path = `novels/${novel.id}/scenes/${dqId}`;
  const url = await uploadImage(path, base64, mimeType);

  const updatedParts = novel.parts.map((p) =>
    p.id !== partId
      ? p
      : {
          ...p,
          discussionQuestions: p.discussionQuestions.map((dq) =>
            dq.id === dqId
              ? { ...dq, sceneImageUrl: url, sceneImage: undefined }
              : dq
          ),
        }
  );
  await updateDoc(doc(db, NOVELS, novel.id), { parts: updatedParts });
  return url;
}

// ── Prompt Templates ─────────────────────────────────────────────

export function subscribePromptTemplates(
  cb: (templates: Partial<Record<PromptTemplateKey, string>>) => void
): Unsubscribe {
  return onSnapshot(collection(db, PROMPT_TEMPLATES), (snap) => {
    const templates: Partial<Record<PromptTemplateKey, string>> = {};
    for (const d of snap.docs) {
      templates[d.id as PromptTemplateKey] = (
        d.data() as { template: string }
      ).template;
    }
    cb(templates);
  });
}

export async function savePromptTemplate(
  key: PromptTemplateKey,
  template: string
): Promise<void> {
  await setDoc(doc(db, PROMPT_TEMPLATES, key), {
    template,
    updatedAt: new Date().toISOString(),
  });
}
