import { type NextRequest, NextResponse } from 'next/server';
import {
  generateContentWithRetry,
  getGenAI,
  PERMISSIVE_SAFETY_SETTINGS,
  requireText,
} from '@/lib/gemini';

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

    const ai = getGenAI();

    const result = await generateContentWithRetry(ai, {
      model: 'gemini-2.5-flash',
      contents: `Create a detailed image generation prompt for this character.

Character: ${characterName}
Info: ${characterInfo}

Requirements:
- Full-body storybook illustration
- Describe appearance, clothing, expression reflecting personality
- Do not mention art style or rendering medium (applied separately at image generation)
- If an exact age is mentioned (e.g. "13 years old"), rephrase it vaguely (e.g. "young", "a child") instead of stating the number — this reduces false-positive safety filter blocks on children's illustration content

Return ONLY the prompt. English only.`,
      config: { safetySettings: PERMISSIVE_SAFETY_SETTINGS },
    });
    return NextResponse.json({ textPrompt: requireText(result).trim() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
