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

const TEXT_MODEL = 'gemini-3.6-flash';

export interface QuestionDraft {
  text: string;
  compositionPrompt: string;
}

export interface QuestionGenerationInput {
  novelTitle: string;
  partContent: string;
  characterNames: string[];
  promptedCharacterNames: string[];
  dqTemplate?: string;
  compositionTemplate?: string;
}

// 챕터 원문으로 질문(DQ)을 만들고, 질문마다 구도 프롬프트를 이어서 만든다.
// 구도 프롬프트의 등장인물은 등록된 캐릭터 안에서만 고르게 한다.
export async function generateQuestionDrafts({
  novelTitle,
  partContent,
  characterNames,
  promptedCharacterNames,
  dqTemplate,
  compositionTemplate,
}: QuestionGenerationInput): Promise<QuestionDraft[]> {
  const ai = getGenAI();
  const config = { safetySettings: PERMISSIVE_SAFETY_SETTINGS };

  // ── Step 1: Discussion Questions (응답 구조는 스키마로 강제) ──────
  const dqResult = await generateContentWithRetry(ai, {
    model: TEXT_MODEL,
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
    responseJsonSchema: buildCompositionResponseSchema(characterNames),
  };

  const drafts: QuestionDraft[] = [];
  for (const questionText of questionTexts) {
    const compResult = await generateContentWithRetry(ai, {
      model: TEXT_MODEL,
      contents: buildCompositionPrompt(
        questionText,
        compositionTemplateText,
        characterNames,
        promptedCharacterNames
      ),
      config: compositionConfig,
    });
    drafts.push({
      text: questionText,
      compositionPrompt: normalizeCharacterNames(
        assembleCompositionText(
          questionText,
          parseCompositionResponse(requireText(compResult))
        ),
        promptedCharacterNames
      ),
    });
  }
  return drafts;
}
