import { after, type NextRequest, NextResponse } from 'next/server';
import { GRAMMAR_FILE_PATH_PATTERN, grammarJobFolder } from '@/lib/blob-upload';
import {
  beginGrammarRun,
  createGrammarJob,
  fetchGrammarJob,
} from '@/lib/firestore';
import { GRAMMAR_MAX_IMAGES, GRAMMAR_MAX_TOTAL } from '@/lib/grammar-job';
import { runGrammarPipeline } from '@/lib/grammar-pipeline';
import { hasOpenAIKey } from '@/lib/openai-image';
import type { GrammarInputFile, GrammarJobInput, GrammarRun } from '@/types';

// 파일 읽기부터 AI 생성까지 응답 이후(after)에 이어서 처리하므로 함수가 허용하는
// 최대 실행 시간으로 잡는다. lib/grammar-job.ts의 GRAMMAR_RUN_STALE_AFTER_MS는 이
// 값보다 길어야 한다.
export const maxDuration = 300;

const JOB_ID_PATTERN = /^[\w-]+$/;
const PDF_MIME = 'application/pdf';

function parseCount(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= GRAMMAR_MAX_TOTAL
    ? value
    : null;
}

// 올린 파일이 규칙에 맞는지 검사한다: 이 작업의 폴더 안, 사진 최대 15장 또는 PDF 1개.
function validateFiles(
  jobId: string,
  files: unknown
): GrammarInputFile[] | null {
  if (!Array.isArray(files) || files.length === 0) return null;
  const parsed: GrammarInputFile[] = [];
  for (const raw of files) {
    const { path, name, mime } = (raw ?? {}) as Record<string, unknown>;
    if (
      typeof path !== 'string' ||
      typeof name !== 'string' ||
      typeof mime !== 'string' ||
      !GRAMMAR_FILE_PATH_PATTERN.test(path) ||
      !path.startsWith(grammarJobFolder(jobId))
    ) {
      return null;
    }
    parsed.push({ path, name, mime });
  }
  const pdfCount = parsed.filter((f) => f.mime === PDF_MIME).length;
  const valid =
    pdfCount === 0
      ? parsed.length <= GRAMMAR_MAX_IMAGES
      : pdfCount === 1 && parsed.length === 1;
  return valid ? parsed : null;
}

// 요청을 접수해 실행 기록을 남기는 것까지만 하고 바로 응답한다. 이후 작업은 브라우저
// 탭과 무관하게 서버가 계속하며, 화면은 Firestore의 작업 문서를 구독해서 진행을 본다.
export async function POST(req: NextRequest) {
  let body: {
    action?: 'create' | 'retry';
    jobId?: string;
    files?: unknown;
    multipleChoiceCount?: unknown;
    shortAnswerCount?: unknown;
    extraRequest?: unknown;
    grammarTemplate?: string;
  };
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }

  const { jobId } = body;
  if (!jobId || !JOB_ID_PATTERN.test(jobId))
    return NextResponse.json(
      { error: 'jobId가 올바르지 않아요' },
      { status: 400 }
    );
  if (!process.env.GEMINI_API_KEY && !hasOpenAIKey())
    return NextResponse.json(
      { error: 'GEMINI_API_KEY, OPENAI_API_KEY가 서버에 설정돼 있지 않아요' },
      { status: 500 }
    );

  const now = new Date().toISOString();
  const run: GrammarRun = {
    id: crypto.randomUUID(),
    status: 'running',
    startedAt: now,
    updatedAt: now,
  };

  let input: GrammarJobInput;
  if (body.action === 'retry') {
    const job = await fetchGrammarJob(jobId);
    if (!job)
      return NextResponse.json(
        { error: '작업을 찾지 못했어요' },
        { status: 404 }
      );
    const outcome = await beginGrammarRun(jobId, run);
    if (outcome === 'not-found')
      return NextResponse.json(
        { error: '작업을 찾지 못했어요' },
        { status: 404 }
      );
    if (outcome === 'already-running')
      return NextResponse.json(
        { error: '이 작업은 이미 생성이 진행 중이에요' },
        { status: 409 }
      );
    input = job.input;
  } else {
    const files = validateFiles(jobId, body.files);
    const multipleChoiceCount = parseCount(body.multipleChoiceCount);
    const shortAnswerCount = parseCount(body.shortAnswerCount);
    if (!files)
      return NextResponse.json(
        {
          error: `파일은 사진 ${GRAMMAR_MAX_IMAGES}장 이하 또는 PDF 1개여야 해요`,
        },
        { status: 400 }
      );
    if (
      multipleChoiceCount === null ||
      shortAnswerCount === null ||
      multipleChoiceCount + shortAnswerCount < 1 ||
      multipleChoiceCount + shortAnswerCount > GRAMMAR_MAX_TOTAL
    )
      return NextResponse.json(
        { error: `문제 수는 1~${GRAMMAR_MAX_TOTAL}개여야 해요` },
        { status: 400 }
      );
    input = {
      files,
      multipleChoiceCount,
      shortAnswerCount,
      extraRequest:
        typeof body.extraRequest === 'string' ? body.extraRequest.trim() : '',
    };
    await createGrammarJob({ id: jobId, createdAt: now, input, run });
  }

  after(() =>
    runGrammarPipeline({
      jobId,
      runId: run.id,
      input,
      template: body.grammarTemplate,
    })
  );

  return NextResponse.json({ accepted: true, runId: run.id });
}
