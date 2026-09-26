import { after, type NextRequest, NextResponse } from 'next/server';
import { runAutoPipeline } from '@/lib/auto-run-pipeline';
import { beginAutoRun } from '@/lib/firestore';
import { hasOpenAIKey, type ReferenceImage } from '@/lib/openai-image';
import type { SceneCharacterInput } from '@/lib/scene-generation';
import type { AutoRunMode } from '@/types';

// 질문·구도 프롬프트 생성부터 장면 이미지 생성까지 전부 응답 이후(after)에 이어서
// 처리하므로, 함수가 허용하는 최대 실행 시간으로 잡는다. lib/auto-run.ts의
// AUTO_RUN_STALE_AFTER_MS는 이 값보다 길어야 한다.
export const maxDuration = 300;

// 요청을 접수해 실행 기록을 남기는 것까지만 하고 바로 응답한다. 이후 작업은 브라우저
// 탭과 무관하게 서버가 계속하며, 화면은 Firestore의 실행 기록을 구독해서 진행을 본다.
export async function POST(req: NextRequest) {
  let body: {
    mode?: AutoRunMode;
    novelId?: string;
    partId?: string;
    novelTitle?: string;
    partContent?: string;
    characters?: SceneCharacterInput[];
    dqTemplate?: string;
    compositionTemplate?: string;
    styleRefImages?: ReferenceImage[];
    stylePrompt?: string;
  };
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
  const { novelId, partId } = body;
  const mode: AutoRunMode =
    body.mode === 'images-only' ? 'images-only' : 'full';

  if (!novelId || !partId)
    return NextResponse.json(
      { error: 'novelId, partId는 필수예요' },
      { status: 400 }
    );
  if (mode === 'full' && !body.partContent)
    return NextResponse.json(
      { error: 'partContent required' },
      { status: 400 }
    );
  if (mode === 'full' && !process.env.GEMINI_API_KEY)
    return NextResponse.json(
      { error: 'GEMINI_API_KEY not configured on server' },
      { status: 500 }
    );
  if (!hasOpenAIKey())
    return NextResponse.json(
      { error: 'OPENAI_API_KEY not configured on server' },
      { status: 500 }
    );

  const runId = crypto.randomUUID();
  const now = new Date().toISOString();
  const outcome = await beginAutoRun(novelId, partId, {
    id: runId,
    status: 'running',
    stage: mode === 'full' ? 'questions' : 'images',
    startedAt: now,
    updatedAt: now,
  });
  if (outcome === 'not-found')
    return NextResponse.json(
      { error: '소설이나 챕터를 찾지 못했어요' },
      { status: 404 }
    );
  if (outcome === 'already-running')
    return NextResponse.json(
      { error: '이 챕터는 이미 자동 생성이 진행 중이에요' },
      { status: 409 }
    );

  after(() =>
    runAutoPipeline({
      runId,
      novelId,
      partId,
      mode,
      novelTitle: body.novelTitle ?? '',
      partContent: body.partContent ?? '',
      characters: body.characters ?? [],
      dqTemplate: body.dqTemplate,
      compositionTemplate: body.compositionTemplate,
      styleRefImages: body.styleRefImages,
      stylePrompt: body.stylePrompt,
    })
  );

  return NextResponse.json({ accepted: true, runId });
}
