import { del, get, list } from '@vercel/blob';
import {
  GRAMMAR_ALLOWED_CONTENT_TYPES,
  GRAMMAR_FILE_PATH_PATTERN,
  grammarJobFolder,
  MAX_IMAGE_BYTES,
} from '@/lib/blob-upload';
import type { OpenAIInputFile } from '@/lib/openai-text';
import type { GrammarInputFile } from '@/types';

// 작업에 딸린 입력 파일(교재 사진·PDF)을 비공개 보관함에서 서버가 직접 읽는다.
// 경로 규칙에 맞는 경로만 읽고, 다시 올린 최신 파일을 읽도록 캐시는 쓰지 않는다.
export async function readGrammarFile(
  file: GrammarInputFile
): Promise<OpenAIInputFile> {
  if (!GRAMMAR_FILE_PATH_PATTERN.test(file.path)) {
    throw new Error(`허용되지 않은 파일 경로입니다: ${file.path}`);
  }
  const result = await get(file.path, { access: 'private', useCache: false });
  if (result?.statusCode !== 200) {
    throw new Error(`올린 파일을 찾지 못했습니다: ${file.name}`);
  }
  const mime = result.blob.contentType.split(';')[0];
  if (!(GRAMMAR_ALLOWED_CONTENT_TYPES as readonly string[]).includes(mime)) {
    throw new Error(`지원하지 않는 파일 형식입니다: ${mime}`);
  }
  const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(`파일이 너무 큽니다: ${file.name}`);
  }
  return { base64: buffer.toString('base64'), mime, name: file.name };
}

// 한 작업의 입력 파일을 전부 지운다.
export async function deleteGrammarJobFiles(jobId: string): Promise<void> {
  const prefix = grammarJobFolder(jobId);
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor });
    if (page.blobs.length > 0) {
      await del(page.blobs.map((blob) => blob.url));
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
}
