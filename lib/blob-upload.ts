import { upload } from '@vercel/blob/client';

// 이미지 저장소는 Vercel Blob의 비공개(private) 보관함. 브라우저가 /api/blob-upload에서
// 받은 짧은 유효기간의 허가증으로 직접 올리고, 읽기는 서버만 한다(lib/image-url.ts).
export const CHARACTER_IMAGE_PATH_PATTERN =
  /^novels\/[\w-]+\/characters\/[\w-]+\.(webp|png|jpg)$/;
export const ALLOWED_IMAGE_CONTENT_TYPES = [
  'image/webp',
  'image/png',
  'image/jpeg',
] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

// basePath(확장자 없는 경로)에 이미지 형식별 확장자를 붙여 올리고 저장된 주소를
// 돌려준다. 같은 경로에 다시 올리면 덮어쓴다.
export async function uploadImageToBlob(
  basePath: string,
  base64: string,
  mime: string
): Promise<string> {
  const extension = EXTENSION_BY_MIME[mime];
  if (!extension) throw new Error(`지원하지 않는 이미지 형식입니다: ${mime}`);
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const blob = await upload(
    `${basePath}.${extension}`,
    new Blob([bytes], { type: mime }),
    {
      access: 'private',
      handleUploadUrl: '/api/blob-upload',
      contentType: mime,
    }
  );
  return blob.url;
}
