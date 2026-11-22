import { del, list } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { fetchNovels } from '@/lib/firestore';
import { sceneImagePath } from '@/lib/scene-image-storage';
import type { SceneSlot } from '@/types';

const SCENE_PATH_SEGMENT = '/scenes/';
const ORPHAN_GRACE_MS = 60 * 24 * 60 * 60 * 1000; // 2달 — 방금 생긴 고아 파일 보호용 유예

// 지금 novel 문서들이 실제로 가리키고 있는 장면 이미지 경로 전부를 모은다. 여기
// 없으면서 /scenes/ 아래인 파일만 "고아"로 본다. 캐릭터 이미지(/characters/)는
// 이 목록에 애초에 포함되지 않으니 절대 건드리지 않는다.
async function collectReferencedScenePaths(): Promise<Set<string>> {
  const novels = await fetchNovels();
  const paths = new Set<string>();
  for (const novel of novels) {
    for (const part of novel.parts) {
      part.discussionQuestions.forEach((dq, dqIndex) => {
        for (const slot of Object.keys(dq.sceneImages ?? {}) as SceneSlot[]) {
          if (dq.sceneImages?.[slot]?.url) {
            paths.add(sceneImagePath(novel.id, part.id, dqIndex, slot));
          }
        }
      });
    }
  }
  return paths;
}

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const referenced = await collectReferencedScenePaths();
  const cutoff = Date.now() - ORPHAN_GRACE_MS;
  const deleted: string[] = [];
  let cursor: string | undefined;

  do {
    const page = await list({ prefix: 'novels/', cursor });
    const orphans = page.blobs.filter(
      (blob) =>
        blob.pathname.includes(SCENE_PATH_SEGMENT) &&
        !referenced.has(blob.pathname) &&
        blob.uploadedAt.getTime() < cutoff
    );
    if (orphans.length > 0) {
      await del(orphans.map((blob) => blob.url));
      deleted.push(...orphans.map((blob) => blob.pathname));
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return NextResponse.json({ deletedCount: deleted.length, deleted });
}
