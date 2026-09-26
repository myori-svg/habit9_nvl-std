import { after, type NextRequest, NextResponse } from 'next/server';
import { saveSceneImage, saveSceneImageError } from '@/lib/firestore';
import {
  generateImage,
  hasOpenAIKey,
  type ReferenceImage,
} from '@/lib/openai-image';
import {
  buildScenePrompt,
  resolveSceneReferenceImages,
  type SceneCharacterInput,
} from '@/lib/scene-generation';
import { uploadSceneImageToBlob } from '@/lib/scene-image-storage';
import type { SceneSlot } from '@/types';

// 응답을 먼저 보내고(생성 시작만 확인), 실제 그림 생성·업로드·Firestore 반영은
// after()로 미뤄서 화면(브라우저 탭)이 요청을 붙들고 기다리지 않게 한다 — 탭을
// 나가거나 새로고침해도 서버는 계속 진행한다.
export async function POST(req: NextRequest) {
  let body: {
    novelId: string;
    partId: string;
    dqId: string;
    dqIndex: number;
    slot: SceneSlot;
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
  if (!novelId || !partId || !dqId || dqIndex == null || !slot)
    return NextResponse.json(
      { error: 'novelId, partId, dqId, dqIndex, slot는 필수예요' },
      { status: 400 }
    );

  after(async () => {
    try {
      const fullPrompt = buildScenePrompt(
        stylePrompt,
        compositionPrompt,
        characters
      );
      const refImages = await resolveSceneReferenceImages(
        styleRefImages,
        characters
      );
      const { imageBase64, imageMime } = await generateImage(
        fullPrompt,
        refImages
      );
      const url = await uploadSceneImageToBlob(
        novelId,
        partId,
        dqIndex,
        slot,
        imageBase64,
        imageMime
      );
      await saveSceneImage(novelId, partId, dqId, slot, url);
    } catch (e) {
      await saveSceneImageError(novelId, partId, dqId, slot, String(e));
    }
  });

  return NextResponse.json({ accepted: true });
}
