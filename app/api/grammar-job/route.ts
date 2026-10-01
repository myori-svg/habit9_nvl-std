import { type NextRequest, NextResponse } from 'next/server';
import { deleteGrammarJob } from '@/lib/firestore';
import { deleteGrammarJobFiles } from '@/lib/grammar-storage';

// 작업 하나와 그 입력 파일을 지운다. 파일은 비공개 보관함에 있어서 브라우저가 직접
// 지우지 못하므로 서버가 대신한다.
export async function DELETE(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('id') ?? '';
  if (!/^[\w-]+$/.test(jobId))
    return NextResponse.json(
      { error: 'id가 올바르지 않아요' },
      { status: 400 }
    );
  try {
    await deleteGrammarJobFiles(jobId);
    await deleteGrammarJob(jobId);
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
