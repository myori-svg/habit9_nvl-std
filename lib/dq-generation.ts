import { generateStructuredText } from '@/lib/openai-text';
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
  // 같은 소설의 다른 챕터에서 이미 만든 질문의 "[제목] 헤드라인" 목록. 갈등 구조
  // 중복을 피하도록 DQ 프롬프트에 그대로 전달된다.
  existingQuestionSummaries?: string[];
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
  existingQuestionSummaries = [],
}: QuestionGenerationInput): Promise<QuestionDraft[]> {
  // ── Step 1: Discussion Questions (응답 구조는 스키마로 강제) ──────
  const dqResult = await generateStructuredText({
    prompt: buildDQPrompt(
      novelTitle,
      partContent,
      resolvePromptTemplate('dq', dqTemplate).template,
      existingQuestionSummaries
    ),
    schemaName: 'discussion_questions',
    schema: QUESTIONS_RESPONSE_SCHEMA,
  });
  const questionTexts =
    parseQuestionsResponse(dqResult).map(assembleQuestionText);

  // ── Step 2: Composition prompt per DQ (기존 등록된 캐릭터만 사용) ──
  const compositionTemplateText = resolvePromptTemplate(
    'composition',
    compositionTemplate
  ).template;
  const compositionSchema = buildCompositionResponseSchema(characterNames);

  const drafts: QuestionDraft[] = [];
  for (const questionText of questionTexts) {
    const compResult = await generateStructuredText({
      prompt: buildCompositionPrompt(
        questionText,
        compositionTemplateText,
        characterNames,
        promptedCharacterNames
      ),
      schemaName: 'composition_prompt',
      schema: compositionSchema,
    });
    drafts.push({
      text: questionText,
      compositionPrompt: normalizeCharacterNames(
        assembleCompositionText(
          questionText,
          parseCompositionResponse(compResult)
        ),
        promptedCharacterNames
      ),
    });
  }
  return drafts;
}
