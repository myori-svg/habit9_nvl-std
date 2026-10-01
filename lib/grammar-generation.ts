import { GEMINI_TEXT_MODEL, getGenAI, requireText } from '@/lib/gemini';
import { hasOpenAIKey } from '@/lib/openai-image';
import {
  generateStructuredText,
  type OpenAIInputFile,
} from '@/lib/openai-text';
import { withTimeout } from '@/lib/withTimeout';
import type {
  GrammarAnalysis,
  GrammarProvider,
  GrammarQuestion,
  GrammarResult,
} from '@/types';

// 서버 함수 최대 실행 시간(300초) 안에 Gemini 시도와 OpenAI 대체 시도가 모두
// 들어가도록 잡는다. 파일을 읽는 시간이 앞에 더해진다.
const GEMINI_TIMEOUT_MS = 100 * 1000;
const OPENAI_TIMEOUT_MS = 150 * 1000;

// OpenAI strict 모드 규칙(모든 객체에 additionalProperties: false, 모든 속성이
// required)을 지키는 스키마라서 Gemini와 OpenAI가 같은 스키마를 쓴다. 필드 설명은
// lib/prompts.ts의 GRAMMAR_OUTPUT_FORMAT_INSTRUCTION과 짝이다.
export const GRAMMAR_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    analysis: {
      type: 'object',
      additionalProperties: false,
      properties: {
        unitTitle: { type: 'string' },
        grammarScope: { type: 'string' },
        keyContrasts: { type: 'array', items: { type: 'string' } },
        commonMistakes: { type: 'array', items: { type: 'string' } },
      },
      required: ['unitTitle', 'grammarScope', 'keyContrasts', 'commonMistakes'],
    },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: { type: 'string', enum: ['multiple-choice', 'short-answer'] },
          question: { type: 'string' },
          choices: { type: 'array', items: { type: 'string' } },
          answer: { type: 'string' },
          explanation: { type: 'string' },
        },
        required: ['type', 'question', 'choices', 'answer', 'explanation'],
      },
    },
  },
  required: ['analysis', 'questions'],
} as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function requireText_(
  source: Record<string, unknown>,
  field: string,
  where: string
): string {
  const value = source[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${where}의 ${field} 값이 비어 있습니다`);
  }
  return value.trim();
}

function toStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function parseQuestion(raw: unknown, index: number): GrammarQuestion {
  const where = `${index + 1}번 문제`;
  const item = asRecord(raw);
  const type = item.type;
  if (type !== 'multiple-choice' && type !== 'short-answer') {
    throw new Error(`${where}의 유형을 알 수 없습니다`);
  }
  const question = requireText_(item, 'question', where);
  const explanation =
    typeof item.explanation === 'string' ? item.explanation.trim() : '';
  let answer = requireText_(item, 'answer', where);

  if (type === 'short-answer') {
    return {
      number: index + 1,
      type,
      question,
      choices: [],
      answer,
      explanation,
    };
  }

  const choices = toStringList(item.choices);
  if (choices.length < 2) {
    throw new Error(`${where}의 보기가 2개보다 적습니다`);
  }
  // "B", "B.", "b) ..." 처럼 와도 보기 글자 하나로 맞춘다.
  const letter = answer.match(/^\(?([A-Za-z])\b/)?.[1]?.toUpperCase();
  const letterIndex = letter ? letter.charCodeAt(0) - 'A'.charCodeAt(0) : -1;
  if (letterIndex < 0 || letterIndex >= choices.length) {
    throw new Error(`${where}의 정답이 보기 글자가 아닙니다: ${answer}`);
  }
  answer = letter as string;
  return { number: index + 1, type, question, choices, answer, explanation };
}

// 모델이 돌려준 JSON을 검증하고 문제 번호를 순서대로 다시 매긴다. 형식이 어긋나면
// 던지며, 호출하는 쪽은 이를 해당 모델의 실패로 취급한다.
export function parseGrammarResponse(text: string): {
  analysis: GrammarAnalysis;
  questions: GrammarQuestion[];
} {
  let root: Record<string, unknown>;
  try {
    root = asRecord(JSON.parse(text));
  } catch {
    throw new Error(`응답을 JSON으로 읽지 못했습니다: ${text.slice(0, 80)}`);
  }
  const rawQuestions = root.questions;
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    throw new Error('문제를 하나도 만들지 못했습니다');
  }
  const analysis = asRecord(root.analysis);
  return {
    analysis: {
      unitTitle:
        typeof analysis.unitTitle === 'string' ? analysis.unitTitle.trim() : '',
      grammarScope:
        typeof analysis.grammarScope === 'string'
          ? analysis.grammarScope.trim()
          : '',
      keyContrasts: toStringList(analysis.keyContrasts),
      commonMistakes: toStringList(analysis.commonMistakes),
    },
    questions: rawQuestions.map(parseQuestion),
  };
}

async function generateWithGemini(
  prompt: string,
  files: OpenAIInputFile[]
): Promise<string> {
  const result = await getGenAI().models.generateContent({
    model: GEMINI_TEXT_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          ...files.map((file) => ({
            inlineData: { mimeType: file.mime, data: file.base64 },
          })),
          { text: prompt },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: GRAMMAR_RESPONSE_SCHEMA,
    },
  });
  return requireText(result);
}

async function generateWithOpenAI(
  prompt: string,
  files: OpenAIInputFile[]
): Promise<string> {
  return generateStructuredText({
    prompt,
    files,
    schemaName: 'grammar_quiz',
    schema: GRAMMAR_RESPONSE_SCHEMA,
  });
}

const ERROR_MESSAGE_MAX_LENGTH = 200;

// API 오류는 {"error":{"message":"{...}"}}처럼 JSON이 겹겹이 싸여 오는 경우가 있어,
// 화면 안내 문구로 읽을 수 있게 가장 안쪽 message만 꺼내고 길이를 제한한다.
function errorMessage(e: unknown): string {
  let message = e instanceof Error ? e.message : String(e);
  for (let depth = 0; depth < 3; depth++) {
    try {
      const inner = JSON.parse(message)?.error?.message;
      if (typeof inner !== 'string') break;
      message = inner;
    } catch {
      break;
    }
  }
  return message.length > ERROR_MESSAGE_MAX_LENGTH
    ? `${message.slice(0, ERROR_MESSAGE_MAX_LENGTH)}…`
    : message;
}

function toResult(
  text: string,
  provider: GrammarProvider,
  geminiFailure?: string
): GrammarResult {
  const { analysis, questions } = parseGrammarResponse(text);
  return {
    provider,
    ...(geminiFailure ? { geminiFailure } : {}),
    analysis,
    questions,
    generatedAt: new Date().toISOString(),
  };
}

// Gemini로 한 번 시도하고, 던지거나 응답이 비었거나 형식이 어긋나면 기다리지 않고
// 바로 OpenAI로 넘어간다. 결과에 어느 쪽이 만들었는지와 Gemini의 실패 이유를 남겨
// 화면이 알릴 수 있게 한다.
export async function generateGrammarQuiz(input: {
  prompt: string;
  files: OpenAIInputFile[];
}): Promise<GrammarResult> {
  const { prompt, files } = input;
  let geminiFailure: string;
  try {
    const text = await withTimeout(
      generateWithGemini(prompt, files),
      GEMINI_TIMEOUT_MS,
      'Gemini'
    );
    return toResult(text, 'gemini');
  } catch (e) {
    geminiFailure = errorMessage(e);
    console.error('[grammar] Gemini 실패, OpenAI로 전환', e);
  }

  if (!hasOpenAIKey()) {
    throw new Error(
      `Gemini 실패: ${geminiFailure} (OpenAI 키가 없어 대체하지 못했어요)`
    );
  }
  try {
    const text = await withTimeout(
      generateWithOpenAI(prompt, files),
      OPENAI_TIMEOUT_MS,
      'OpenAI'
    );
    return toResult(text, 'openai', geminiFailure);
  } catch (e) {
    throw new Error(
      `Gemini 실패: ${geminiFailure} / OpenAI 실패: ${errorMessage(e)}`
    );
  }
}
