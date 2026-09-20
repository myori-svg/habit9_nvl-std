import { type NextRequest, NextResponse } from 'next/server';
import {
  generateImage,
  hasOpenAIKey,
  type ReferenceImage,
} from '@/lib/openai-image';

export async function POST(req: NextRequest) {
  try {
    const { styleRefImages, stylePrompt, textPrompt } = await req.json();
    if (!hasOpenAIKey())
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured on server' },
        { status: 500 }
      );
    if (!textPrompt)
      return NextResponse.json(
        { error: 'textPrompt required' },
        { status: 400 }
      );

    const refImages: ReferenceImage[] = styleRefImages ?? [];

    const prompt = `${stylePrompt ? `Style: ${stylePrompt}${refImages.length > 0 ? ' (match the style of the reference images provided)' : ''}\n\n` : ''}${textPrompt}`;

    return NextResponse.json(await generateImage(prompt, refImages));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
