import { type NextRequest, NextResponse } from 'next/server';
import {
  generateContentWithRetry,
  getGenAI,
  PERMISSIVE_SAFETY_SETTINGS,
} from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const { styleRefImages, stylePrompt, compositionPrompt, characters } =
      await req.json();
    if (!process.env.GEMINI_API_KEY)
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured on server' },
        { status: 500 }
      );

    const genAI = getGenAI();
    const imageModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-image',
      safetySettings: PERMISSIVE_SAFETY_SETTINGS,
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: '16:9' },
      } as never,
    });

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

    const parts: Array<
      { text: string } | { inlineData: { data: string; mimeType: string } }
    > = [];
    for (const img of (styleRefImages ?? []) as {
      base64: string;
      mime: string;
    }[]) {
      parts.push({ inlineData: { data: img.base64, mimeType: img.mime } });
    }
    for (const c of characters) {
      if (c.imageBase64)
        parts.push({
          inlineData: {
            data: c.imageBase64,
            mimeType: c.imageMime || 'image/png',
          },
        });
    }
    parts.push({ text: fullPrompt });

    const result = await generateContentWithRetry(imageModel, parts as never);
    for (const part of result.response.candidates?.[0]?.content?.parts ?? []) {
      const p = part as { inlineData?: { data: string; mimeType: string } };
      if (p.inlineData)
        return NextResponse.json({
          imageBase64: p.inlineData.data,
          imageMime: p.inlineData.mimeType,
        });
    }
    return NextResponse.json({ error: 'No image generated' }, { status: 500 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
