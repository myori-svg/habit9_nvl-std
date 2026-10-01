import type { GrammarQuestion, GrammarRun } from '@/types';

export const GRAMMAR_DEFAULT_TOTAL = 15;
export const GRAMMAR_MAX_TOTAL = 30;
export const GRAMMAR_MAX_IMAGES = 15;

// 원본 파일과 결과는 이 기간이 지나면 정리 배치(app/api/cleanup-grammar)가 지운다.
export const GRAMMAR_RETENTION_DAYS = 7;

// 서버 함수의 최대 실행 시간(app/api/grammar-run/route.ts의 maxDuration, 300초)보다
// 길게 갱신이 없으면 서버가 중간에 끊긴 것으로 본다.
export const GRAMMAR_RUN_STALE_AFTER_MS = 6 * 60 * 1000;

export function isGrammarRunStalled(run: GrammarRun, now: number): boolean {
  return (
    run.status === 'running' &&
    now - Date.parse(run.updatedAt) > GRAMMAR_RUN_STALE_AFTER_MS
  );
}

// 서버가 지금도 작업 중인 실행인지. 끊긴(stalled) 실행은 포함하지 않는다.
export function isGrammarRunInProgress(
  run: GrammarRun | undefined,
  now: number
): run is GrammarRun {
  return run?.status === 'running' && !isGrammarRunStalled(run, now);
}

// 지정한 실행이 아직 이 작업의 현재 실행인지. 중지됐거나 새 실행으로 교체됐으면 false.
export function isCurrentGrammarRun(
  run: GrammarRun | undefined,
  runId: string
): run is GrammarRun {
  return run?.id === runId && run.status === 'running';
}

// 입력 칸의 문자열을 개수로 읽는다. 비어 있으면 null, 0 이상의 정수가 아니면 NaN.
export function parseCountInput(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

export interface QuestionCounts {
  multipleChoice: number;
  shortAnswer: number;
  total: number;
}

// 객관식·서술형 칸에 하나라도 입력했으면 그 합계가 전체 문제 수를 대신한다. 둘 다
// 비어 있으면 전체 문제 수(없으면 기본값)를 객관식 : 서술형 = 2 : 1로 나눈다.
export function resolveQuestionCounts(input: {
  total: number | null;
  multipleChoice: number | null;
  shortAnswer: number | null;
}): QuestionCounts {
  if (input.multipleChoice !== null || input.shortAnswer !== null) {
    const multipleChoice = input.multipleChoice ?? 0;
    const shortAnswer = input.shortAnswer ?? 0;
    return {
      multipleChoice,
      shortAnswer,
      total: multipleChoice + shortAnswer,
    };
  }
  const total = input.total ?? GRAMMAR_DEFAULT_TOTAL;
  const multipleChoice = Math.round((total * 2) / 3);
  return { multipleChoice, shortAnswer: total - multipleChoice, total };
}

// ── 복사용 텍스트 ─────────────────────────────────────────────────

const CHOICE_LETTERS = 'ABCDEFGH';

// "1. 문제 문장" + 객관식이면 "A. 보기" 줄들. PPT 문제 슬라이드에 그대로 붙여넣는 모양.
export function formatQuestionForCopy(question: GrammarQuestion): string {
  const lines = [`${question.number}. ${question.question}`];
  question.choices.forEach((choice, i) => {
    lines.push(`${CHOICE_LETTERS[i]}. ${choice}`);
  });
  return lines.join('\n');
}

export function formatAllQuestionsForCopy(
  questions: GrammarQuestion[]
): string {
  return questions.map(formatQuestionForCopy).join('\n\n');
}

export function formatAllAnswersForCopy(questions: GrammarQuestion[]): string {
  return questions.map((q) => `${q.number}. ${q.answer}`).join('\n');
}
