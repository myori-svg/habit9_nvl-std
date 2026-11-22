import { del, list } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { deleteGrammarJob, fetchGrammarJobs } from '@/lib/firestore';
import { GRAMMAR_RETENTION_DAYS } from '@/lib/grammar-job';
import { deleteGrammarJobFiles } from '@/lib/grammar-storage';

const DAY_MS = 24 * 60 * 60 * 1000;
// 작업 문서가 만들어지기 전에 올라간 파일(업로드 직후 요청 접수 전)을 지우지 않도록
// 작업 문서가 없는 파일도 이 시간이 지난 뒤에만 고아로 본다.
const ORPHAN_GRACE_MS = DAY_MS;

// 만든 지 보관 기간이 지난 Grammar 작업(문서와 입력 파일)을 지우고, 작업 문서 없이
// 보관함에만 남은 파일도 정리한다.
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const jobs = await fetchGrammarJobs();
  const expiredBefore = Date.now() - GRAMMAR_RETENTION_DAYS * DAY_MS;
  const expired = jobs.filter(
    (job) => Date.parse(job.createdAt) < expiredBefore
  );
  for (const job of expired) {
    await deleteGrammarJobFiles(job.id);
    await deleteGrammarJob(job.id);
  }

  const expiredIds = new Set(expired.map((job) => job.id));
  const liveIds = new Set(
    jobs.filter((job) => !expiredIds.has(job.id)).map((job) => job.id)
  );
  const orphanCutoff = Date.now() - ORPHAN_GRACE_MS;
  const orphans: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: 'grammar/', cursor });
    const stale = page.blobs.filter((blob) => {
      const jobId = blob.pathname.split('/')[1];
      return !liveIds.has(jobId) && blob.uploadedAt.getTime() < orphanCutoff;
    });
    if (stale.length > 0) {
      await del(stale.map((blob) => blob.url));
      orphans.push(...stale.map((blob) => blob.pathname));
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return NextResponse.json({
    expiredJobCount: expired.length,
    orphanFileCount: orphans.length,
  });
}
