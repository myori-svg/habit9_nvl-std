import { get } from '@vercel/blob';
import { type NextRequest, NextResponse } from 'next/server';
import { SCENE_IMAGE_PATH_PATTERN } from '@/lib/scene-image-storage';

// 비공개 보관함의 장면 이미지를 브라우저가 볼 수 있도록 서버가 대신 읽어 내려준다.
// 장면 이미지 경로 규칙에 맞는 경로만 읽는다.
export async function GET(request: NextRequest) {
  const pathname = request.nextUrl.searchParams.get('path') ?? '';
  if (!SCENE_IMAGE_PATH_PATTERN.test(pathname)) {
    return NextResponse.json({ error: 'invalid path' }, { status: 400 });
  }
  const result = await get(pathname, { access: 'private', useCache: false });
  if (result?.statusCode !== 200) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return new Response(result.stream, {
    headers: {
      'Content-Type': result.blob.contentType,
      // 같은 경로를 덮어써도 주소의 v 값이 바뀌므로 오래 캐시해도 안전하다.
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}
