import { type NextRequest, NextResponse } from 'next/server';
import {
  generateContentWithRetry,
  getGenAI,
  PERMISSIVE_SAFETY_SETTINGS,
} from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const { styleRefImages, stylePrompt, textPrompt } = await req.json();
    if (!process.env.GEMINI_API_KEY)
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured on server' },
        { status: 500 }
      );
    if (!textPrompt)
      return NextResponse.json(
        { error: 'textPrompt required' },
        { status: 400 }
      );

    const ai = getGenAI();

    const refImages: { base64: string; mime: string }[] = styleRefImages ?? [];

    const parts: Array<
      { text: string } | { inlineData: { data: string; mimeType: string } }
    > = [];
    for (const img of refImages) {
      parts.push({ inlineData: { data: img.base64, mimeType: img.mime } });
    }
    parts.push({
      text: `${stylePrompt ? `Style: ${stylePrompt}${refImages.length > 0 ? ' (match the style of the reference images provided)' : ''}\n\n` : ''}${textPrompt}`,
    });

    const result = await generateContentWithRetry(ai, {
      model: 'gemini-3.1-flash-image',
      contents: parts,
      config: {
        safetySettings: PERMISSIVE_SAFETY_SETTINGS,
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: '16:9' },
      },
    });
    for (const part of result.candidates?.[0]?.content?.parts ?? []) {
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
