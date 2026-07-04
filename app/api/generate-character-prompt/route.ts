import { GoogleGenerativeAI } from '@google/generative-ai';
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { characterName, characterInfo } = await req.json();
    if (!process.env.GEMINI_API_KEY)
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured on server' },
        { status: 500 }
      );
    if (!characterInfo)
      return NextResponse.json(
        { error: 'characterInfo required' },
        { status: 400 }
      );

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const textModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result =
      await textModel.generateContent(`Create a detailed image generation prompt for this character.

Character: ${characterName}
Info: ${characterInfo}

Requirements:
- Full-body storybook illustration
- Describe appearance, clothing, expression reflecting personality
- Do not mention art style or rendering medium (applied separately at image generation)

Return ONLY the prompt. English only.`);
    return NextResponse.json({ textPrompt: result.response.text().trim() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
