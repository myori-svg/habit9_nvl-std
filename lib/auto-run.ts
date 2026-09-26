import { splitCompositionScenes } from '@/lib/output-format';
import type { AutoRun, DiscussionQuestion, SceneSlot } from '@/types';

// 서버 백그라운드 작업이 시간 제한으로 끊기면 실행 기록이 'running'인 채로 남는다.
// 서버 함수의 최대 실행 시간(app/api/auto-run/route.ts의 maxDuration, 300초)보다
// 길게 갱신이 없으면 그렇게 끊긴 것으로 본다.
export const AUTO_RUN_STALE_AFTER_MS = 6 * 60 * 1000;

export function isAutoRunStalled(run: AutoRun, now: number): boolean {
  return (
    run.status === 'running' &&
    now - Date.parse(run.updatedAt) > AUTO_RUN_STALE_AFTER_MS
  );
}

// 서버가 지금도 작업 중인 실행인지. 끊긴(stalled) 실행은 포함하지 않는다.
export function isAutoRunInProgress(
  run: AutoRun | undefined,
  now: number
): run is AutoRun {
  return run?.status === 'running' && !isAutoRunStalled(run, now);
}

// 지정한 실행이 아직 이 챕터의 현재 실행인지. 중지됐거나 새 실행으로 교체됐으면 false.
export function isCurrentRun(
  run: AutoRun | undefined,
  runId: string
): run is AutoRun {
  return run?.id === runId && run.status === 'running';
}

export interface SceneWorkItem {
  dqId: string;
  dqIndex: number;
  slot: SceneSlot;
  text: string;
}

// 질문마다 구도 프롬프트를 본문/Option A/Option B로 나눠, 내용이 있는 장면만
// 이미지 생성 대상으로 모은다.
export function buildSceneWorkItems(
  dqs: DiscussionQuestion[]
): SceneWorkItem[] {
  const items: SceneWorkItem[] = [];
  dqs.forEach((dq, dqIndex) => {
    const split = splitCompositionScenes(dq.compositionPrompt);
    (
      [
        ['main', split.main],
        ['optionA', split.optionA],
        ['optionB', split.optionB],
      ] as [SceneSlot, string][]
    ).forEach(([slot, text]) => {
      if (text) items.push({ dqId: dq.id, dqIndex, slot, text });
    });
  });
  return items;
}
