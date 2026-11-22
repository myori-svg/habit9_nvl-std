import { type NextRequest, NextResponse } from 'next/server';
import {
  generateImage,
  hasOpenAIKey,
  type ReferenceImage,
} from '@/lib/openai-image';
import { buildCharacterImagePrompt } from '@/lib/prompts';

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

    const prompt = buildCharacterImagePrompt(
      stylePrompt,
      textPrompt,
      refImages.length > 0
    );

    return NextResponse.json(await generateImage(prompt, refImages));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
