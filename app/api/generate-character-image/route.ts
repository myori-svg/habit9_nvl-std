import { GoogleGenerativeAI } from '@google/generative-ai';
import { type NextRequest, NextResponse } from 'next/server';

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

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const imageModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-image',
      generationConfig: {
        // @ts-expect-error responseModalities/imageConfig not yet in SDK types
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: '16:9' },
      },
    });

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

    const result = await imageModel.generateContent(parts as never);
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
