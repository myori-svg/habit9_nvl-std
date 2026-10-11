import { type NextRequest, NextResponse } from 'next/server';
import { hasOpenAIKey } from '@/lib/openai-image';
import { generateText } from '@/lib/openai-text';

export async function POST(req: NextRequest) {
  try {
    const { characterName, characterInfo } = await req.json();
    if (!hasOpenAIKey())
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured on server' },
        { status: 500 }
      );
    if (!characterInfo)
      return NextResponse.json(
        { error: 'characterInfo required' },
        { status: 400 }
      );

    const textPrompt =
      await generateText(`Create a detailed image generation prompt for this character.

Character: ${characterName}
Info: ${characterInfo}

Requirements:
- Full-body storybook illustration
- Describe appearance, clothing, expression reflecting personality
- Do not mention art style or rendering medium (applied separately at image generation)
- If an exact age is mentioned (e.g. "13 years old"), rephrase it vaguely (e.g. "young", "a child") instead of stating the number — this reduces false-positive safety filter blocks on children's illustration content

Return ONLY the prompt. English only.`);
    return NextResponse.json({ textPrompt: textPrompt.trim() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
