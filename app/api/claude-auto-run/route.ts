import { after, type NextRequest, NextResponse } from 'next/server';
import { runAutoPipeline } from '@/lib/auto-run-pipeline';
import {
  beginAutoRun,
  fetchNovels,
  fetchPart,
  fetchPromptTemplates,
} from '@/lib/firestore';
import { hasOpenAIKey } from '@/lib/openai-image';
import type { SceneCharacterInput } from '@/lib/scene-generation';
import type { AutoRunMode, Novel, NovelPart } from '@/types';

// Claude Code가 로컬에서 배포된 서버로 직접 부르는 전용 엔드포인트. 브라우저가
// 쓰는 /api/auto-run은 인증이 없어 그대로 두고, 이 라우트만 비밀값으로 막는다.
export const maxDuration = 300;

const norm = (s: string) => s.trim().toLowerCase();

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CLAUDE_API_SECRET;
  return (
    Boolean(secret) && req.headers.get('authorization') === `Bearer ${secret}`
  );
}

function findNovelAndPart(
  novels: Novel[],
  novelTitle: string,
  partLabel: string
): { novel: Novel; part: NovelPart } | { error: string } {
  const novel = novels.find((n) => norm(n.title) === norm(novelTitle));
  if (!novel) return { error: `소설을 찾지 못했어요: ${novelTitle}` };
  const part = novel.parts.find((p) => norm(p.label) === norm(partLabel));
  if (!part) return { error: `챕터를 찾지 못했어요: ${partLabel}` };
  return { novel, part };
}

function toSceneCharacterInputs(novel: Novel): SceneCharacterInput[] {
  return novel.characters.map((c) => ({
    name: c.name,
    textPrompt: c.textPrompt,
    imageUrl: c.imageUrl,
  }));
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { novelTitle?: string; partLabel?: string; mode?: AutoRunMode };
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }

  const { novelTitle, partLabel } = body;
  const mode: AutoRunMode =
    body.mode === 'images-only' ? 'images-only' : 'full';
  if (!novelTitle || !partLabel)
    return NextResponse.json(
      { error: 'novelTitle, partLabel은 필수예요' },
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

  const novels = await fetchNovels();
  const found = findNovelAndPart(novels, novelTitle, partLabel);
  if ('error' in found)
    return NextResponse.json({ error: found.error }, { status: 404 });
  const { novel, part } = found;

  const runId = crypto.randomUUID();
  const now = new Date().toISOString();
  const outcome = await beginAutoRun(novel.id, part.id, {
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

  const templates = await fetchPromptTemplates();

  after(() =>
    runAutoPipeline({
      runId,
      novelId: novel.id,
      partId: part.id,
      mode,
      novelTitle: novel.title,
      partContent: part.content,
      characters: toSceneCharacterInputs(novel),
      dqTemplate: templates.dq,
      compositionTemplate: templates.composition,
      stylePrompt: novel.stylePrompt,
    })
  );

  return NextResponse.json({
    accepted: true,
    runId,
    novelId: novel.id,
    partId: part.id,
  });
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const novelId = searchParams.get('novelId');
  const partId = searchParams.get('partId');
  const runId = searchParams.get('runId');
  if (!novelId || !partId)
    return NextResponse.json(
      { error: 'novelId, partId는 필수예요' },
      { status: 400 }
    );

  const part = await fetchPart(novelId, partId);
  if (!part)
    return NextResponse.json(
      { error: '소설이나 챕터를 찾지 못했어요' },
      { status: 404 }
    );

  return NextResponse.json({
    autoRun: part.autoRun ?? null,
    isSameRun: runId ? part.autoRun?.id === runId : undefined,
    questions: part.discussionQuestions.map((dq) => ({
      id: dq.id,
      text: dq.text,
      sceneImages: dq.sceneImages ?? {},
    })),
  });
}
