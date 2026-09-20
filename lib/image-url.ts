import { get } from '@vercel/blob';
import {
  ALLOWED_IMAGE_CONTENT_TYPES,
  CHARACTER_IMAGE_PATH_PATTERN,
  MAX_IMAGE_BYTES,
} from './blob-upload';
import type { ReferenceImage } from './openai-image';

// 저장된 캐릭터 이미지 주소에서 경로만 뽑아 비공개 보관함에서 서버가 직접 읽는다.
// 브라우저가 이미지를 통째로 서버에 실어 보내면 요청 크기 한도에 걸릴 수 있어서
// 주소만 받는다. 임의 주소를 가져가지 않도록 캐릭터 이미지 경로 규칙에 맞는
// 경로만 읽고, 덮어쓴 최신 이미지를 읽도록 캐시는 쓰지 않는다.
export async function fetchBlobImage(url: string): Promise<ReferenceImage> {
  const pathname = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  if (!CHARACTER_IMAGE_PATH_PATTERN.test(pathname)) {
    throw new Error(`허용되지 않은 이미지 경로입니다: ${pathname}`);
  }
  const result = await get(pathname, { access: 'private', useCache: false });
  if (result?.statusCode !== 200) {
    throw new Error(`저장된 캐릭터 이미지를 찾지 못했습니다: ${pathname}`);
  }
  const mime = result.blob.contentType.split(';')[0];
  if (!(ALLOWED_IMAGE_CONTENT_TYPES as readonly string[]).includes(mime)) {
    throw new Error(`지원하지 않는 이미지 형식입니다: ${mime}`);
  }
  const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('이미지가 너무 큽니다');
  }
  return { base64: buffer.toString('base64'), mime };
}
