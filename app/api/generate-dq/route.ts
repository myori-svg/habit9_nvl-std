import { type NextRequest, NextResponse } from 'next/server';
import {
  generateContentWithRetry,
  getGenAI,
  PERMISSIVE_SAFETY_SETTINGS,
  requireText,
} from '@/lib/gemini';
import {
  buildCompositionPrompt,
  buildDQPrompt,
  DEFAULT_PROMPT_TEMPLATES,
} from '@/lib/prompts';

export async function POST(req: NextRequest) {
  const {
    novelTitle,
    partContent,
    characterNames,
    dqTemplate,
    compositionTemplate,
  } = await req.json();
  if (!process.env.GEMINI_API_KEY)
    return NextResponse.json(
      { error: 'GEMINI_API_KEY not configured on server' },
      { status: 500 }
    );
  if (!partContent)
    return NextResponse.json(
      { error: 'partContent required' },
      { status: 400 }
    );

  try {
    const ai = getGenAI();
    const model = 'gemini-2.5-flash';
    const config = { safetySettings: PERMISSIVE_SAFETY_SETTINGS };

    // ── Step 1: Discussion Questions ──────────────────────────────
    const dqPrompt = buildDQPrompt(
      novelTitle,
      partContent,
      dqTemplate ?? DEFAULT_PROMPT_TEMPLATES.dq
    );
    const dqResult = await generateContentWithRetry(ai, {
      model,
      contents: `${dqPrompt}

Return ONLY a JSON array of question strings, no markdown fences:
["Question 1", "Question 2"]`,
      config,
    });
    const dqText = requireText(dqResult)
      .trim()
      .replace(/```json|```/g, '')
      .trim();
    const questions: string[] = JSON.parse(dqText);

    // ── Step 2: Composition prompt per DQ (기존 등록된 캐릭터만 사용) ──
    const discussionQuestions = [];
    for (const q of questions) {
      const compositionPrompt = buildCompositionPrompt(
        q,
        compositionTemplate ?? DEFAULT_PROMPT_TEMPLATES.composition,
        characterNames
      );
      const compResult = await generateContentWithRetry(ai, {
        model,
        contents: compositionPrompt,
        config,
      });
      discussionQuestions.push({
        id: crypto.randomUUID(),
        text: q,
        compositionPrompt: requireText(compResult).trim(),
      });
    }

    return NextResponse.json({ discussionQuestions });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
