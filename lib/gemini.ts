import {
  BlockedReason,
  FinishReason,
  type GenerateContentParameters,
  type GenerateContentResponse,
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
} from '@google/genai';

// 2025-11-30부로 지원이 완전히 종료된 @google/generative-ai(구 SDK)에서
// 공식 후속 SDK인 @google/genai로 이전 (AI-01, 2026-08-26).
// https://github.com/google-gemini/deprecated-generative-ai-js

// 소설 삽화 특성상 미성년 캐릭터의 외형 묘사가 정상적으로 자주 등장하는데,
// Gemini 기본 세이프티 임계값은 이를 아동 관련 민감 콘텐츠로 오탐해
// PROHIBITED_CONTENT로 차단하는 경우가 있다. 모든 카테고리를 최대한
// 관대하게 풀어 오탐을 줄인다 (실제 생성 내용은 프롬프트 그대로 유지됨).
export const PERMISSIVE_SAFETY_SETTINGS = [
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
].map((category) => ({
  category,
  threshold: HarmBlockThreshold.BLOCK_NONE,
}));

export function getGenAI(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
}

// Gemini의 세이프티 판정은 확률적이라 동일한 입력도 호출마다 통과/차단이
// 갈린다 (실측: 같은 프롬프트를 반복 호출 시 PROHIBITED_CONTENT가 간헐적으로
// 발생). safetySettings 조정으로는 없앨 수 없어, 차단 시 짧게 대기 후
// 재시도하는 것으로 대응한다.
//
// 주의: generateContent()는 응답이 차단돼도 그 자체로는 reject되지 않는다.
// 프롬프트 단계에서 통째로 막히면 candidates가 아예 undefined이고
// promptFeedback.blockReason에 담기며, candidate까지는 생성됐지만 완성 전에
// 막히면 candidates[0].finishReason에 담긴다. try/catch가 아니라 이 두 필드를
// 직접 확인해서 재시도 여부를 판단한다. (참고: 구 SDK는 이 상태에서
// response.text() 호출 시 예외를 던졌지만, 새 SDK의 response.text는 그냥
// undefined를 반환한다 — 아래 requireText로 명시적 에러를 던지게 맞춰둠.)
const PROHIBITED_CONTENT_RETRIES = 3;
const RETRY_DELAY_MS = 500;

function isBlockedByProhibitedContent(
  result: GenerateContentResponse
): boolean {
  const blockReason = result.promptFeedback?.blockReason;
  const finishReason = result.candidates?.[0]?.finishReason;
  return (
    blockReason === BlockedReason.PROHIBITED_CONTENT ||
    finishReason === FinishReason.PROHIBITED_CONTENT ||
    finishReason === FinishReason.IMAGE_PROHIBITED_CONTENT
  );
}

export async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: GenerateContentParameters
): Promise<GenerateContentResponse> {
  let lastResult: GenerateContentResponse | undefined;
  for (let attempt = 1; attempt <= PROHIBITED_CONTENT_RETRIES; attempt++) {
    lastResult = await ai.models.generateContent(params);
    if (!isBlockedByProhibitedContent(lastResult)) return lastResult;
    if (attempt < PROHIBITED_CONTENT_RETRIES) {
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAY_MS * attempt)
      );
    }
  }
  return lastResult as GenerateContentResponse;
}

// result.text는 텍스트 파트가 없으면(차단 등) undefined를 반환한다.
// 재시도까지 다 거치고도 비어 있으면 원인을 알 수 있게 명시적으로 던진다.
export function requireText(result: GenerateContentResponse): string {
  if (!result.text) {
    const reason =
      result.promptFeedback?.blockReason ??
      result.candidates?.[0]?.finishReason ??
      'unknown';
    throw new Error(
      `Gemini가 텍스트를 반환하지 않았습니다 (reason: ${reason})`
    );
  }
  return result.text;
}

// Convert Google Drive share URL to direct image URL
export function driveUrlToDirectUrl(driveUrl: string): string {
  const match = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return `https://drive.google.com/uc?export=view&id=${match[1]}`;
  }
  return driveUrl;
}

// Fetch image as base64 from Google Drive
export async function fetchImageAsBase64(
  url: string
): Promise<{ data: string; mimeType: string } | null> {
  try {
    const directUrl = driveUrlToDirectUrl(url);
    const res = await fetch(
      `/api/fetch-image?url=${encodeURIComponent(directUrl)}`
    );
    if (!res.ok) return null;
    const { data, mimeType } = await res.json();
    return { data, mimeType };
  } catch {
    return null;
  }
}
