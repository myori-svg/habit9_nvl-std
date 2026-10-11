import { type NextRequest, NextResponse } from 'next/server';
import {
  generateImage,
  hasOpenAIKey,
  type ReferenceImage,
} from '@/lib/openai-image';

export async function POST(req: NextRequest) {
  try {
    const { styleRefImages, stylePrompt, compositionPrompt, characters } =
      await req.json();
    if (!hasOpenAIKey())
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured on server' },
        { status: 500 }
      );

    const styleRef =
      stylePrompt ||
      'A heartwarming watercolor and colored pencil storybook illustration. Muted pastels, earthy browns, delicate hand-drawn outlines, decorative vine border.';
    const charPromptsText = characters
      .map(
        (c: { name: string; textPrompt: string }) =>
          `{${c.name}}: ${c.textPrompt}`
      )
      .join('\n\n');

    const fullPrompt = `Generate a storybook illustration following these rules:
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

    // 스타일 참조 이미지가 먼저, 캐릭터 이미지가 그 뒤 — 프롬프트의 "first reference image"가 스타일 참조를 가리킨다.
    const refImages: ReferenceImage[] = [
      ...((styleRefImages ?? []) as ReferenceImage[]),
      ...characters
        .filter((c: { imageBase64?: string }) => c.imageBase64)
        .map((c: { imageBase64: string; imageMime?: string }) => ({
          base64: c.imageBase64,
          mime: c.imageMime || 'image/png',
        })),
    ];

    return NextResponse.json(await generateImage(fullPrompt, refImages));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
