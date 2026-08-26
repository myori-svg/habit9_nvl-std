import { type NextRequest, NextResponse } from 'next/server';
import {
  generateContentWithRetry,
  getGenAI,
  PERMISSIVE_SAFETY_SETTINGS,
  requireText,
} from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const { novelTitle, characterName, summary } = await req.json();
    if (!process.env.GEMINI_API_KEY)
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured on server' },
        { status: 500 }
      );
    if (!characterName)
      return NextResponse.json(
        { error: 'characterName required' },
        { status: 400 }
      );

    const ai = getGenAI();

    const result = await generateContentWithRetry(ai, {
      model: 'gemini-2.5-flash',
      contents: `
Describe the character "${characterName}" from the novel "${novelTitle}".
${summary ? `Story summary for context:\n${summary}\n` : ''}
Include: age, physical appearance (hair, eyes, build, clothing), personality traits, story role.
When describing age, avoid stating an exact number (e.g. "13 years old") — use a vague phrase like "a young child" or "elementary-school age" instead, to reduce false-positive safety filter blocks on children's illustration content.
Be specific. Under 150 words.
`,
      config: { safetySettings: PERMISSIVE_SAFETY_SETTINGS },
    });

    return NextResponse.json({ info: requireText(result).trim() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
