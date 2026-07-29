import {
  type GenerateContentResult,
  type GenerativeModel,
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from '@google/generative-ai';

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

export function getGenAI(): GoogleGenerativeAI {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
}

// Gemini의 세이프티 판정은 확률적이라 동일한 입력도 호출마다 통과/차단이
// 갈린다 (실측: 같은 프롬프트를 반복 호출 시 PROHIBITED_CONTENT가 간헐적으로
// 발생). safetySettings 조정으로는 없앨 수 없어, 차단 시 짧게 대기 후
// 재시도하는 것으로 대응한다.
//
// 주의: generateContent()는 응답이 차단돼도 그 자체로는 reject되지 않는다.
// 프롬프트 단계에서 통째로 막히면 candidates가 아예 undefined이고
// promptFeedback.blockReason에 담기며, candidate까지는 생성됐지만 완성 전에
// 막히면 candidates[0].finishReason에 담긴다. 두 경우 다 이후 response.text()
// 호출 시점에야 예외가 던져지므로, try/catch가 아니라 이 두 필드를 직접
// 확인해서 재시도 여부를 판단한다.
const PROHIBITED_CONTENT_RETRIES = 3;
const RETRY_DELAY_MS = 500;

function isBlockedByProhibitedContent(result: GenerateContentResult): boolean {
  const { response } = result;
  // SDK의 BlockReason/FinishReason 타입 선언이 실제 API 값(PROHIBITED_CONTENT)을
  // 아직 포함하지 않아 string으로 비교한다.
  const blockReason = response.promptFeedback?.blockReason as
    | string
    | undefined;
  const finishReason = response.candidates?.[0]?.finishReason as
    | string
    | undefined;
  return (
    blockReason === 'PROHIBITED_CONTENT' ||
    finishReason === 'PROHIBITED_CONTENT'
  );
}

export async function generateContentWithRetry(
  model: GenerativeModel,
  request: Parameters<GenerativeModel['generateContent']>[0]
): Promise<GenerateContentResult> {
  let lastResult: GenerateContentResult | undefined;
  for (let attempt = 1; attempt <= PROHIBITED_CONTENT_RETRIES; attempt++) {
    lastResult = await model.generateContent(request);
    if (!isBlockedByProhibitedContent(lastResult)) return lastResult;
    if (attempt < PROHIBITED_CONTENT_RETRIES) {
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAY_MS * attempt)
      );
    }
  }
  return lastResult as GenerateContentResult;
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
