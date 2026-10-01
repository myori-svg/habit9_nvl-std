// 이미지 생성 전용 OpenAI 클라이언트. 텍스트 생성은 lib/gemini.ts(Gemini)가 담당한다.
// 별도 SDK 없이 REST를 직접 호출한다.

const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images';

export const OPENAI_IMAGE_MODEL =
  process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-flare';

// 2.5 계열은 가로세로가 16의 배수인 임의 해상도를 지원해 정확한 16:9가 가능하다.
const LANDSCAPE_SIZE = '1536x864';

const IMAGE_QUALITY = 'medium';

// 같은 화질에서 PNG보다 훨씬 작아서, 응답·저장·전송 크기 한도에 여유를 준다.
const OUTPUT_FORMAT = 'webp';
const OUTPUT_COMPRESSION = 85;

export type ReferenceImage = { base64: string; mime: string };

export type GeneratedImage = { imageBase64: string; imageMime: string };

export function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function extensionOf(mime: string): string {
  return mime.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
}

// 이미지 생성 API가 거절한 응답. status로 다시 시도할 만한 실패인지 판단한다.
export class OpenAIImageError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterMs: number | null
  ) {
    super(message);
  }
}

// 요청 한도 초과는 "Please try again in 12s"처럼 메시지에 대기 시간을 알려준다.
function parseRetryAfterMs(res: Response, message: string): number | null {
  const header = Number(res.headers.get('retry-after'));
  if (header > 0) return header * 1000;
  const match = message.match(/try again in (\d+(?:\.\d+)?)(ms|s)\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  return match[2].toLowerCase() === 'ms' ? value : value * 1000;
}

export async function readOpenAIError(res: Response): Promise<string> {
  const body = await res.text();
  try {
    const message = JSON.parse(body)?.error?.message;
    if (message) return `OpenAI ${res.status}: ${message}`;
  } catch {
    // JSON이 아니면 원문 그대로 사용
  }
  return `OpenAI ${res.status}: ${body}`;
}

// 참조 이미지가 있으면 edits(참조 이미지 + 프롬프트), 없으면 generations를 호출한다.
// edits의 image 배열은 넘긴 순서대로 "첫 번째 참조 이미지", "두 번째…"가 된다.
export async function generateImage(
  prompt: string,
  referenceImages: ReferenceImage[] = []
): Promise<GeneratedImage> {
  const headers = { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` };
  let res: Response;

  if (referenceImages.length > 0) {
    const form = new FormData();
    form.append('model', OPENAI_IMAGE_MODEL);
    form.append('prompt', prompt);
    form.append('size', LANDSCAPE_SIZE);
    form.append('quality', IMAGE_QUALITY);
    form.append('output_format', OUTPUT_FORMAT);
    form.append('output_compression', String(OUTPUT_COMPRESSION));
    form.append('moderation', 'low');
    referenceImages.forEach((img, i) => {
      const bytes = Buffer.from(img.base64, 'base64');
      form.append(
        'image[]',
        new Blob([bytes], { type: img.mime }),
        `reference-${i}.${extensionOf(img.mime)}`
      );
    });
    res = await fetch(`${OPENAI_IMAGES_URL}/edits`, {
      method: 'POST',
      headers,
      body: form,
    });
  } else {
    res = await fetch(`${OPENAI_IMAGES_URL}/generations`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OPENAI_IMAGE_MODEL,
        prompt,
        size: LANDSCAPE_SIZE,
        quality: IMAGE_QUALITY,
        output_format: OUTPUT_FORMAT,
        output_compression: OUTPUT_COMPRESSION,
        moderation: 'low',
      }),
    });
  }

  if (!res.ok) {
    const message = await readOpenAIError(res);
    throw new OpenAIImageError(
      message,
      res.status,
      parseRetryAfterMs(res, message)
    );
  }

  const json = (await res.json()) as { data?: { b64_json?: string }[] };
  const imageBase64 = json.data?.[0]?.b64_json;
  if (!imageBase64) throw new Error('OpenAI가 이미지를 반환하지 않았습니다');
  return { imageBase64, imageMime: `image/${OUTPUT_FORMAT}` };
}

// 요청 한도 초과(429)와 일시적인 서버 오류(5xx)만 기다렸다가 다시 시도한다. 키 오류
// 같은 나머지 실패는 다시 해도 같으므로 바로 던진다. 대기 시간이 길어지므로 최대 실행
// 시간이 넉넉한 백그라운드 작업에서만 쓴다.
const MAX_RETRIES = 3;
const DEFAULT_RETRY_WAIT_MS = 15 * 1000;
const MAX_RETRY_WAIT_MS = 60 * 1000;

function isTransient(e: unknown): e is OpenAIImageError {
  return e instanceof OpenAIImageError && (e.status === 429 || e.status >= 500);
}

export async function generateImageWithRetry(
  prompt: string,
  referenceImages: ReferenceImage[] = []
): Promise<GeneratedImage> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await generateImage(prompt, referenceImages);
    } catch (e) {
      if (attempt >= MAX_RETRIES || !isTransient(e)) throw e;
      const waitMs = Math.min(
        (e.retryAfterMs ?? DEFAULT_RETRY_WAIT_MS) + Math.random() * 2000,
        MAX_RETRY_WAIT_MS
      );
      console.warn(
        `[openai-image] ${e.status} — ${Math.round(waitMs / 1000)}초 뒤 다시 시도 (${attempt + 1}/${MAX_RETRIES})`
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}
