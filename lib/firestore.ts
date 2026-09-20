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
import type { DiscussionQuestion, Novel } from '@/types';
import { uploadImageToBlob } from './blob-upload';
import { db } from './firebase';
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

// sceneImages 슬롯(main/optionA/optionB)에서 in-memory 전용 필드(base64/mime)를
// 빼고 url만 남긴다. 슬롯 자체가 비어 있으면(url도 없으면) 필드를 통째로 뺀다.
function stripSceneImages(
  sceneImages: DiscussionQuestion['sceneImages']
): DiscussionQuestion['sceneImages'] {
  if (!sceneImages) return sceneImages;
  const stripped = Object.fromEntries(
    Object.entries(sceneImages)
      .filter(([, img]) => img?.url)
      .map(([slot, img]) => [slot, { url: img?.url }])
  );
  return Object.keys(stripped).length > 0 ? stripped : undefined;
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
        sceneImages: stripSceneImages(dq.sceneImages),
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

// ── Image Storage (Vercel Blob) ──────────────────────────────────

// 캐릭터 이미지를 Blob에 올리고 imageUrl로 캐릭터 문서에 반영한다. base64·mime은
// in-memory 전용이라 Firestore에 쓰지 않는다.
export async function saveCharacterImage(
  novel: Novel,
  charId: string,
  base64: string,
  mimeType: string
): Promise<string> {
  const url = await uploadImageToBlob(
    `novels/${novel.id}/characters/${charId}`,
    base64,
    mimeType
  );
  const updatedChars = novel.characters.map(
    ({ imageBase64: _base64, imageMime: _mime, ...char }) =>
      char.id === charId ? { ...char, imageUrl: url } : char
  );
  await updateDoc(doc(db, NOVELS, novel.id), {
    characters: stripUndefined(updatedChars),
  });
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

// 저장된 커스텀 템플릿을 지우면 그 키는 코드의 기본 템플릿으로 돌아간다.
export async function deletePromptTemplate(
  key: PromptTemplateKey
): Promise<void> {
  await deleteDoc(doc(db, PROMPT_TEMPLATES, key));
}
