import { after, type NextRequest, NextResponse } from 'next/server';
import { saveSceneImage, saveSceneImageError } from '@/lib/firestore';
import { hasOpenAIKey, type ReferenceImage } from '@/lib/openai-image';
import {
  generateSceneImageUrl,
  type SceneCharacterInput,
} from '@/lib/scene-generation';
import type { SceneSlot } from '@/types';

// 그림 생성·업로드·저장을 응답 이후(after)에 이어서 하므로, 이 시간 안에 끝나야
// 한다. 요청 한도 초과 시 기다렸다 다시 시도하는 시간까지 포함한다.
// components/WorkPanel.tsx의 SCENE_REGEN_STALE_AFTER_MS는 이 값보다 길어야 한다.
export const maxDuration = 300;

// 장면 이미지 한 장(개별 재생성)을 만든다. 응답을 먼저 보내고(생성 시작만 확인),
// 실제 그림 생성·업로드·Firestore 반영은 after()로 미뤄서 화면(브라우저 탭)이
// 요청을 붙들고 기다리지 않게 한다 — 탭을 나가거나 새로고침해도 서버는 계속 진행한다.
// 결과는 requestId와 함께 저장되고, 화면은 그 ID로 이번 요청의 결과인지 판단한다.
export async function POST(req: NextRequest) {
  let body: {
    novelId: string;
    partId: string;
    dqId: string;
    dqIndex: number;
    slot: SceneSlot;
    requestId: string;
    styleRefImages?: ReferenceImage[];
    stylePrompt?: string;
    compositionPrompt: string;
    characters: SceneCharacterInput[];
  };
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
  const {
    novelId,
    partId,
    dqId,
    dqIndex,
    slot,
    requestId,
    styleRefImages,
    stylePrompt,
    compositionPrompt,
    characters,
  } = body;

  if (!hasOpenAIKey())
    return NextResponse.json(
      { error: 'OPENAI_API_KEY not configured on server' },
      { status: 500 }
    );
  if (!novelId || !partId || !dqId || dqIndex == null || !slot || !requestId)
    return NextResponse.json(
      { error: 'novelId, partId, dqId, dqIndex, slot, requestId는 필수예요' },
      { status: 400 }
    );

  after(async () => {
    try {
      const url = await generateSceneImageUrl({
        novelId,
        partId,
        dqIndex,
        slot,
        stylePrompt,
        styleRefImages,
        compositionPrompt,
        characters,
      });
      await saveSceneImage(novelId, partId, dqId, slot, url, { requestId });
    } catch (e) {
      console.error('[generate-scene] 장면 이미지 생성 실패', dqId, slot, e);
      await saveSceneImageError(novelId, partId, dqId, slot, String(e), {
        requestId,
      }).catch((saveError) =>
        console.error('[generate-scene] 실패 기록 저장 실패', saveError)
      );
    }
  });

  return NextResponse.json({ accepted: true });
}
