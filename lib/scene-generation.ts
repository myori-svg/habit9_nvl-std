import { fetchBlobImage } from '@/lib/image-url';
import { generateImage, type ReferenceImage } from '@/lib/openai-image';
import { uploadSceneImageToBlob } from '@/lib/scene-image-storage';
import type { SceneSlot } from '@/types';

export interface SceneCharacterInput {
  name: string;
  textPrompt: string;
  imageUrl?: string;
  imageBase64?: string;
  imageMime?: string;
}

const DEFAULT_STYLE_PROMPT =
  'A heartwarming watercolor and colored pencil storybook illustration. Muted pastels, earthy browns, delicate hand-drawn outlines, decorative vine border.';

export function buildScenePrompt(
  stylePrompt: string | undefined,
  compositionPrompt: string,
  characters: SceneCharacterInput[]
): string {
  const styleRef = stylePrompt || DEFAULT_STYLE_PROMPT;
  const charPromptsText = characters
    .map((c) => `{${c.name}}: ${c.textPrompt}`)
    .join('\n\n');

  return `Generate a storybook illustration following these rules:
- Style: match <image style> and the first reference image
- Characters: use <character prompts> and reference images for each character
- Composition: follow <composition> exactly
- Dynamic facial expressions
- 16:9 ratio

<image style>
${styleRef}

<composition>
${compositionPrompt}

<character prompts>
${charPromptsText}`;
}

// 캐릭터 이미지는 저장된 주소(imageUrl)로 오면 서버가 직접 내려받고, 저장 전인
// 이미지는 base64로 온다. 스타일 참조 이미지가 먼저, 캐릭터 이미지가 그 뒤 —
// 프롬프트의 "first reference image"가 스타일 참조를 가리킨다.
export async function resolveSceneReferenceImages(
  styleRefImages: ReferenceImage[] | undefined,
  characters: SceneCharacterInput[]
): Promise<ReferenceImage[]> {
  const characterImages = (
    await Promise.all(
      characters.map(async (c) => {
        if (c.imageUrl) return fetchBlobImage(c.imageUrl);
        if (c.imageBase64)
          return { base64: c.imageBase64, mime: c.imageMime || 'image/png' };
        return null;
      })
    )
  ).filter((img): img is ReferenceImage => img !== null);

  return [...(styleRefImages ?? []), ...characterImages];
}

export interface SceneImageRequest {
  novelId: string;
  partId: string;
  dqIndex: number;
  slot: SceneSlot;
  stylePrompt?: string;
  styleRefImages?: ReferenceImage[];
  compositionPrompt: string;
  characters: SceneCharacterInput[];
}

// 장면 이미지 한 장을 만들어 보관함의 고정 자리에 올리고, 화면용 주소를 돌려준다.
// Firestore 반영은 호출하는 쪽이 한다.
export async function generateSceneImageUrl(
  request: SceneImageRequest
): Promise<string> {
  const prompt = buildScenePrompt(
    request.stylePrompt,
    request.compositionPrompt,
    request.characters
  );
  const referenceImages = await resolveSceneReferenceImages(
    request.styleRefImages,
    request.characters
  );
  const { imageBase64, imageMime } = await generateImage(
    prompt,
    referenceImages
  );
  return uploadSceneImageToBlob(
    request.novelId,
    request.partId,
    request.dqIndex,
    request.slot,
    imageBase64,
    imageMime
  );
}
