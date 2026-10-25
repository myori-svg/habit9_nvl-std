import { get } from '@vercel/blob';
import { type NextRequest, NextResponse } from 'next/server';
import { CHARACTER_IMAGE_PATH_PATTERN } from '@/lib/blob-upload';

// 비공개 보관함의 캐릭터 이미지를 브라우저(또는 외부 스크립트)가 볼 수 있도록
// 서버가 대신 읽어 내려준다. 캐릭터 이미지 경로 규칙에 맞는 경로만 읽는다.
export async function GET(request: NextRequest) {
  const pathname = request.nextUrl.searchParams.get('path') ?? '';
  if (!CHARACTER_IMAGE_PATH_PATTERN.test(pathname)) {
    return NextResponse.json({ error: 'invalid path' }, { status: 400 });
  }
  const result = await get(pathname, { access: 'private', useCache: false });
  if (result?.statusCode !== 200) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return new Response(result.stream, {
    headers: {
      'Content-Type': result.blob.contentType,
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}
