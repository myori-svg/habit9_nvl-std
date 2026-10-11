// 텍스트 생성 전용 OpenAI 클라이언트. 이미지는 lib/openai-image.ts가 담당한다.
// 별도 SDK 없이 Responses API를 REST로 직접 호출한다.

import { readOpenAIError } from './openai-image';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

export const OPENAI_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-6-luna';

export type TextReferenceImage = { base64: string; mime: string };

interface ResponsesOutput {
  status?: string;
  incomplete_details?: { reason?: string };
  output?: {
    type: string;
    content?: { type: string; text?: string; refusal?: string }[];
  }[];
}

// 참조 이미지(있으면)와 프롬프트로 자유 형식 텍스트를 받는다. JSON이 필요한
// 곳은 프롬프트에서 직접 요청하고 호출부가 파싱한다(Gemini 쪽과 동일한 방식).
export async function generateText(
  prompt: string,
  referenceImages: TextReferenceImage[] = []
): Promise<string> {
  const res = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_TEXT_MODEL,
      input: [
        {
          role: 'user',
          content: [
            ...referenceImages.map((img) => ({
              type: 'input_image',
              image_url: `data:${img.mime};base64,${img.base64}`,
            })),
            { type: 'input_text', text: prompt },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(await readOpenAIError(res));

  const json = (await res.json()) as ResponsesOutput;
  if (json.status === 'incomplete') {
    throw new Error(
      `OpenAI 응답이 끝까지 만들어지지 않았습니다 (${json.incomplete_details?.reason ?? 'unknown'})`
    );
  }
  const parts = (json.output ?? [])
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content ?? []);
  const refusal = parts.find((part) => part.type === 'refusal');
  if (refusal) {
    throw new Error(`OpenAI가 응답을 거절했습니다: ${refusal.refusal ?? ''}`);
  }
  const text = parts
    .filter((part) => part.type === 'output_text')
    .map((part) => part.text ?? '')
    .join('');
  if (!text) throw new Error('OpenAI가 텍스트를 반환하지 않았습니다');
  return text;
}
