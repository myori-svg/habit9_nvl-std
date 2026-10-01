// 사진·PDF를 읽고 JSON 스키마에 맞는 텍스트를 만드는 OpenAI 클라이언트. Gemini가
// 실패했을 때의 대체 경로로만 쓴다. 별도 SDK 없이 Responses API를 REST로 직접 호출한다.

import { readOpenAIError } from './openai-image';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

export const OPENAI_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-6-luna';

export interface OpenAIInputFile {
  base64: string;
  mime: string;
  name: string;
}

type ContentPart =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string }
  | { type: 'input_file'; filename: string; file_data: string };

function toContentPart(file: OpenAIInputFile): ContentPart {
  const dataUrl = `data:${file.mime};base64,${file.base64}`;
  return file.mime === 'application/pdf'
    ? { type: 'input_file', filename: file.name, file_data: dataUrl }
    : { type: 'input_image', image_url: dataUrl };
}

interface ResponsesOutput {
  status?: string;
  incomplete_details?: { reason?: string };
  output?: {
    type: string;
    content?: { type: string; text?: string; refusal?: string }[];
  }[];
}

// schema는 strict 모드 규칙(모든 객체에 additionalProperties: false, 모든 속성이
// required)을 지켜야 한다.
export async function generateStructuredText({
  prompt,
  files,
  schemaName,
  schema,
}: {
  prompt: string;
  files: OpenAIInputFile[];
  schemaName: string;
  schema: object;
}): Promise<string> {
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
            ...files.map(toContentPart),
            { type: 'input_text', text: prompt },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: schemaName,
          strict: true,
          schema,
        },
      },
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
