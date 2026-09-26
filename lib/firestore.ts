import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  type Unsubscribe,
  updateDoc,
} from 'firebase/firestore';
import type {
  AutoRun,
  DiscussionQuestion,
  Novel,
  NovelPart,
  SceneSlot,
} from '@/types';
import { isAutoRunInProgress, isCurrentRun } from './auto-run';
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
// 빼고 url·error만 남긴다. 슬롯 자체가 비어 있으면(url도 error도 없으면) 필드를 통째로 뺀다.
function stripSceneImages(
  sceneImages: DiscussionQuestion['sceneImages']
): DiscussionQuestion['sceneImages'] {
  if (!sceneImages) return sceneImages;
  const stripped = Object.fromEntries(
    Object.entries(sceneImages)
      .filter(([, img]) => img?.url || img?.error)
      .map(([slot, img]) => [slot, { url: img?.url, error: img?.error }])
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

// ── 챕터 단위 갱신 (서버 백그라운드 작업과 화면이 같은 문서를 함께 고친다) ──────

// 장면 이미지 여러 장이 거의 동시에 끝나며 같은 문서를 고치므로, 충돌 재시도
// 횟수를 기본값(5)보다 넉넉하게 둔다.
const TRANSACTION_MAX_ATTEMPTS = 10;

// 챕터 하나를 "최신 문서 읽기 → 고치기 → 쓰기"를 트랜잭션으로 묶어 갱신한다.
// Firestore는 배열 원소를 경로(parts.0.…)로 부분 갱신할 수 없다 — 경로 중간이
// 배열이면 그 배열이 통째로 map으로 바뀐다. 그래서 parts 배열 전체를 다시 쓴다.
// mutate가 part를 돌려주지 않으면 쓰지 않고 result만 돌려준다. 문서나 챕터가
// 없으면 undefined.
async function updatePart<T>(
  novelId: string,
  partId: string,
  mutate: (part: NovelPart) => { result: T; part?: NovelPart }
): Promise<T | undefined> {
  const ref = doc(db, NOVELS, novelId);
  return runTransaction(
    db,
    async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return undefined;
      const novel = snap.data() as Novel;
      const index = novel.parts.findIndex((p) => p.id === partId);
      if (index === -1) return undefined;
      const { result, part } = mutate(novel.parts[index]);
      if (part) {
        tx.update(ref, {
          parts: stripUndefined(
            novel.parts.map((p, i) => (i === index ? part : p))
          ),
        });
      }
      return result;
    },
    { maxAttempts: TRANSACTION_MAX_ATTEMPTS }
  );
}

export async function fetchPart(
  novelId: string,
  partId: string
): Promise<NovelPart | null> {
  const snap = await getDoc(doc(db, NOVELS, novelId));
  if (!snap.exists()) return null;
  return (
    (snap.data() as Novel).parts.find((part) => part.id === partId) ?? null
  );
}

// 장면 이미지 한 장의 결과(주소 또는 실패 메시지)를 해당 질문의 슬롯에 기록한다.
// runId를 주면 그 실행이 아직 현재 실행일 때 진행 시각도 함께 갱신한다. 질문이
// 이미 사라졌으면(새 실행으로 교체됨) 아무것도 쓰지 않는다.
async function updateSceneImageSlot(
  novelId: string,
  partId: string,
  dqId: string,
  slot: SceneSlot,
  value: { url: string } | { error: string },
  runId?: string
): Promise<void> {
  await updatePart(novelId, partId, (part) => {
    if (!part.discussionQuestions.some((dq) => dq.id === dqId)) {
      return { result: undefined };
    }
    return {
      result: undefined,
      part: {
        ...part,
        discussionQuestions: part.discussionQuestions.map((dq) =>
          dq.id === dqId
            ? { ...dq, sceneImages: { ...dq.sceneImages, [slot]: value } }
            : dq
        ),
        autoRun:
          runId && isCurrentRun(part.autoRun, runId)
            ? { ...part.autoRun, updatedAt: new Date().toISOString() }
            : part.autoRun,
      },
    };
  });
}

export async function saveSceneImage(
  novelId: string,
  partId: string,
  dqId: string,
  slot: SceneSlot,
  url: string,
  runId?: string
): Promise<void> {
  await updateSceneImageSlot(novelId, partId, dqId, slot, { url }, runId);
}

export async function saveSceneImageError(
  novelId: string,
  partId: string,
  dqId: string,
  slot: SceneSlot,
  message: string,
  runId?: string
): Promise<void> {
  await updateSceneImageSlot(
    novelId,
    partId,
    dqId,
    slot,
    { error: message },
    runId
  );
}

// ── 자동 생성 실행 기록 ─────────────────────────────────────────────

// 챕터에 새 실행 기록을 남긴다. 이미 서버가 작업 중인 실행이 있으면 시작하지 않는다.
export async function beginAutoRun(
  novelId: string,
  partId: string,
  run: AutoRun
): Promise<'started' | 'already-running' | 'not-found'> {
  const outcome = await updatePart(novelId, partId, (part) =>
    isAutoRunInProgress(part.autoRun, Date.now())
      ? { result: 'already-running' as const }
      : { result: 'started' as const, part: { ...part, autoRun: run } }
  );
  return outcome ?? 'not-found';
}

// 새로 만든 질문·구도 프롬프트로 챕터의 질문 목록을 교체하고 실행을 이미지 단계로
// 넘긴다. 이 실행이 이미 중지됐거나 교체됐으면 저장하지 않고 null.
export async function saveGeneratedQuestions(
  novelId: string,
  partId: string,
  runId: string,
  questions: { text: string; compositionPrompt: string }[]
): Promise<DiscussionQuestion[] | null> {
  const saved = await updatePart(novelId, partId, (part) => {
    if (!isCurrentRun(part.autoRun, runId)) return { result: null };
    const discussionQuestions: DiscussionQuestion[] = questions.map((q) => ({
      id: crypto.randomUUID(),
      text: q.text,
      compositionPrompt: q.compositionPrompt,
    }));
    return {
      result: discussionQuestions,
      part: {
        ...part,
        discussionQuestions,
        autoRun: {
          ...part.autoRun,
          stage: 'images',
          updatedAt: new Date().toISOString(),
        },
      },
    };
  });
  return saved ?? null;
}

// 현재 실행일 때만 종료 상태(done/error)를 기록한다. 이미 중지됐거나 새 실행으로
// 교체됐다면 그 상태를 덮어쓰지 않는다.
async function endAutoRun(
  novelId: string,
  partId: string,
  runId: string,
  end: { status: 'done' } | { status: 'error'; error: string }
): Promise<void> {
  await updatePart(novelId, partId, (part) =>
    isCurrentRun(part.autoRun, runId)
      ? {
          result: undefined,
          part: {
            ...part,
            autoRun: {
              ...part.autoRun,
              ...end,
              updatedAt: new Date().toISOString(),
            },
          },
        }
      : { result: undefined }
  );
}

export async function finishAutoRun(
  novelId: string,
  partId: string,
  runId: string
): Promise<void> {
  await endAutoRun(novelId, partId, runId, { status: 'done' });
}

export async function failAutoRun(
  novelId: string,
  partId: string,
  runId: string,
  error: string
): Promise<void> {
  await endAutoRun(novelId, partId, runId, { status: 'error', error });
}

// 서버는 이미지 한 장을 시작하기 전마다 실행 상태를 확인하므로, 중지하면 아직
// 시작하지 않은 이미지는 만들지 않는다. 이미 만들고 있던 이미지는 끝나는 대로 저장된다.
export async function stopAutoRun(
  novelId: string,
  partId: string
): Promise<void> {
  await updatePart(novelId, partId, (part) =>
    part.autoRun?.status === 'running'
      ? {
          result: undefined,
          part: {
            ...part,
            autoRun: {
              ...part.autoRun,
              status: 'stopped',
              updatedAt: new Date().toISOString(),
            },
          },
        }
      : { result: undefined }
  );
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
