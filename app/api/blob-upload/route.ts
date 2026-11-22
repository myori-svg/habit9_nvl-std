import { type HandleUploadBody, handleUpload } from '@vercel/blob/client';
import { type NextRequest, NextResponse } from 'next/server';
import {
  ALLOWED_IMAGE_CONTENT_TYPES,
  CHARACTER_IMAGE_PATH_PATTERN,
  GRAMMAR_ALLOWED_CONTENT_TYPES,
  GRAMMAR_FILE_PATH_PATTERN,
  MAX_IMAGE_BYTES,
} from '@/lib/blob-upload';

// 브라우저가 Blob에 직접 파일을 올릴 수 있도록 짧은 유효기간의 업로드 허가증을
// 발급한다. 파일 본문은 이 서버를 거치지 않는다. 캐릭터 이미지 경로와 Grammar 퀴즈
// 입력 파일 경로만 허용하고, 경로마다 허용하는 형식이 다르다. 같은 경로에 다시
// 올리면 덮어쓴다.
function allowedContentTypesFor(pathname: string): string[] {
  if (CHARACTER_IMAGE_PATH_PATTERN.test(pathname)) {
    return [...ALLOWED_IMAGE_CONTENT_TYPES];
  }
  if (GRAMMAR_FILE_PATH_PATTERN.test(pathname)) {
    return [...GRAMMAR_ALLOWED_CONTENT_TYPES];
  }
  throw new Error(`허용되지 않은 저장 경로입니다: ${pathname}`);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => ({
        allowedContentTypes: allowedContentTypesFor(pathname),
        maximumSizeInBytes: MAX_IMAGE_BYTES,
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 60,
      }),
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
