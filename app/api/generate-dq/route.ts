import { type NextRequest, NextResponse } from 'next/server';
import {
  generateContentWithRetry,
  getGenAI,
  PERMISSIVE_SAFETY_SETTINGS,
  requireText,
} from '@/lib/gemini';
import {
  assembleCompositionText,
  assembleQuestionText,
  buildCompositionResponseSchema,
  normalizeCharacterNames,
  parseCompositionResponse,
  parseQuestionsResponse,
  QUESTIONS_RESPONSE_SCHEMA,
} from '@/lib/output-format';
import {
  buildCompositionPrompt,
  buildDQPrompt,
  resolvePromptTemplate,
} from '@/lib/prompts';

export async function POST(req: NextRequest) {
  const {
    novelTitle,
    partContent,
    characterNames,
    promptedCharacterNames,
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
    const model = 'gemini-3.6-flash';
    const config = { safetySettings: PERMISSIVE_SAFETY_SETTINGS };
    const names: string[] = characterNames ?? [];
    const promptedNames: string[] = promptedCharacterNames ?? [];

    // ── Step 1: Discussion Questions (응답 구조는 스키마로 강제) ──────
    const dqResult = await generateContentWithRetry(ai, {
      model,
      contents: buildDQPrompt(
        novelTitle,
        partContent,
        resolvePromptTemplate('dq', dqTemplate).template
      ),
      config: {
        ...config,
        responseMimeType: 'application/json',
        responseJsonSchema: QUESTIONS_RESPONSE_SCHEMA,
      },
    });
    const questionTexts = parseQuestionsResponse(requireText(dqResult)).map(
      assembleQuestionText
    );

    // ── Step 2: Composition prompt per DQ (기존 등록된 캐릭터만 사용) ──
    const compositionTemplateText = resolvePromptTemplate(
      'composition',
      compositionTemplate
    ).template;
    const compositionConfig = {
      ...config,
      responseMimeType: 'application/json',
      responseJsonSchema: buildCompositionResponseSchema(names),
    };

    const discussionQuestions = [];
    for (const questionText of questionTexts) {
      const compResult = await generateContentWithRetry(ai, {
        model,
        contents: buildCompositionPrompt(
          questionText,
          compositionTemplateText,
          names,
          promptedNames
        ),
        config: compositionConfig,
      });
      discussionQuestions.push({
        id: crypto.randomUUID(),
        text: questionText,
        compositionPrompt: normalizeCharacterNames(
          assembleCompositionText(
            questionText,
            parseCompositionResponse(requireText(compResult))
          ),
          promptedNames
        ),
      });
    }

    return NextResponse.json({ discussionQuestions });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
