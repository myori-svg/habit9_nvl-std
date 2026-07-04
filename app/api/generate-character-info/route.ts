import { GoogleGenerativeAI } from '@google/generative-ai';
import { type NextRequest, NextResponse } from 'next/server';

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

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const textModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await textModel.generateContent(`
Describe the character "${characterName}" from the novel "${novelTitle}".
${summary ? `Story summary for context:\n${summary}\n` : ''}
Include: age, physical appearance (hair, eyes, build, clothing), personality traits, story role.
Be specific. Under 150 words.
`);

    return NextResponse.json({ info: result.response.text().trim() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
