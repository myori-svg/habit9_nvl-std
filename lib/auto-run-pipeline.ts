import {
  buildSceneWorkItems,
  isCurrentRun,
  type SceneWorkItem,
} from '@/lib/auto-run';
import { generateQuestionDrafts } from '@/lib/dq-generation';
import {
  failAutoRun,
  fetchPart,
  finishAutoRun,
  saveGeneratedQuestions,
  saveSceneImage,
  saveSceneImageError,
} from '@/lib/firestore';
import type { ReferenceImage } from '@/lib/openai-image';
import {
  getPromptedCharacterNames,
  pickMentionedCharacters,
} from '@/lib/prompts';
import {
  generateSceneImageUrl,
  type SceneCharacterInput,
} from '@/lib/scene-generation';
import type { AutoRunMode, DiscussionQuestion } from '@/types';

// 이미지 생성 API의 요청 한도와 서버 메모리(참조 이미지를 장면마다 올린다)를 넘지
// 않도록 동시에 만드는 장면 수를 제한한다.
const IMAGE_CONCURRENCY = 3;

export interface AutoRunInput {
  runId: string;
  novelId: string;
  partId: string;
  mode: AutoRunMode;
  novelTitle: string;
  partContent: string;
  characters: SceneCharacterInput[];
  dqTemplate?: string;
  compositionTemplate?: string;
  styleRefImages?: ReferenceImage[];
  stylePrompt?: string;
}

// items를 최대 limit개씩 동시에 처리한다. worker는 스스로 오류를 처리해야 한다.
async function forEachWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let next = 0;
  const lanes = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        await worker(items[next++]);
      }
    }
  );
  await Promise.all(lanes);
}

async function isRunStillCurrent(input: AutoRunInput): Promise<boolean> {
  const part = await fetchPart(input.novelId, input.partId);
  return isCurrentRun(part?.autoRun, input.runId);
}

// 저장할 질문 목록을 준비한다. 이 실행이 중간에 중지·교체됐으면 null.
async function prepareQuestions(
  input: AutoRunInput
): Promise<DiscussionQuestion[] | null> {
  if (input.mode === 'images-only') {
    const part = await fetchPart(input.novelId, input.partId);
    if (!part) throw new Error('챕터를 찾지 못했어요');
    return part.discussionQuestions;
  }
  const drafts = await generateQuestionDrafts({
    novelTitle: input.novelTitle,
    partContent: input.partContent,
    characterNames: input.characters.map((c) => c.name),
    promptedCharacterNames: getPromptedCharacterNames(input.characters),
    dqTemplate: input.dqTemplate,
    compositionTemplate: input.compositionTemplate,
  });
  return saveGeneratedQuestions(
    input.novelId,
    input.partId,
    input.runId,
    drafts
  );
}

async function generateSceneForItem(
  input: AutoRunInput,
  item: SceneWorkItem
): Promise<void> {
  if (!(await isRunStillCurrent(input))) return;
  const { novelId, partId, runId } = input;
  try {
    const url = await generateSceneImageUrl({
      novelId,
      partId,
      dqIndex: item.dqIndex,
      slot: item.slot,
      stylePrompt: input.stylePrompt,
      styleRefImages: input.styleRefImages,
      compositionPrompt: item.text,
      characters: pickMentionedCharacters(item.text, input.characters),
    });
    await saveSceneImage(novelId, partId, item.dqId, item.slot, url, runId);
  } catch (e) {
    console.error('[auto-run] 장면 이미지 생성 실패', item.dqId, item.slot, e);
    await saveSceneImageError(
      novelId,
      partId,
      item.dqId,
      item.slot,
      String(e),
      runId
    ).catch((saveError) =>
      console.error('[auto-run] 실패 기록 저장 실패', saveError)
    );
  }
}

// 질문·구도 프롬프트 생성부터 장면 이미지 생성까지 서버에서 끝까지 진행한다.
// 진행 상황과 결과는 모두 Firestore에 기록되고, 화면은 그것을 구독해서 본다.
// 어떤 실패도 밖으로 던지지 않고 실행 기록의 error로 남긴다.
export async function runAutoPipeline(input: AutoRunInput): Promise<void> {
  const { novelId, partId, runId } = input;
  try {
    const questions = await prepareQuestions(input);
    if (!questions) return;

    const items = buildSceneWorkItems(questions).filter(
      (item) =>
        input.mode === 'full' ||
        !questions[item.dqIndex].sceneImages?.[item.slot]?.url
    );
    await forEachWithConcurrency(items, IMAGE_CONCURRENCY, (item) =>
      generateSceneForItem(input, item)
    );
    await finishAutoRun(novelId, partId, runId);
  } catch (e) {
    console.error('[auto-run] 자동 생성 실패', novelId, partId, e);
    await failAutoRun(novelId, partId, runId, String(e)).catch((saveError) =>
      console.error('[auto-run] 실패 기록 저장 실패', saveError)
    );
  }
}
