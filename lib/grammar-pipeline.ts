import { failGrammarRun, finishGrammarRun } from '@/lib/firestore';
import { generateGrammarQuiz } from '@/lib/grammar-generation';
import { readGrammarFile } from '@/lib/grammar-storage';
import { buildGrammarPrompt, resolvePromptTemplate } from '@/lib/prompts';
import type { GrammarJobInput } from '@/types';

export interface GrammarPipelineInput {
  jobId: string;
  runId: string;
  input: GrammarJobInput;
  template?: string;
}

// 입력 파일을 읽어 퀴즈를 만들고 작업 문서에 결과를 기록한다. 어떤 실패도 밖으로
// 던지지 않고 실행 기록의 error로 남긴다.
export async function runGrammarPipeline({
  jobId,
  runId,
  input,
  template,
}: GrammarPipelineInput): Promise<void> {
  try {
    const files = await Promise.all(input.files.map(readGrammarFile));
    const prompt = buildGrammarPrompt(
      {
        multipleChoiceCount: input.multipleChoiceCount,
        shortAnswerCount: input.shortAnswerCount,
      },
      input.extraRequest,
      resolvePromptTemplate('grammar', template).template
    );
    const result = await generateGrammarQuiz({ prompt, files });
    await finishGrammarRun(jobId, runId, result);
  } catch (e) {
    console.error('[grammar] 퀴즈 생성 실패', jobId, e);
    await failGrammarRun(
      jobId,
      runId,
      e instanceof Error ? e.message : String(e)
    ).catch((saveError) =>
      console.error('[grammar] 실패 기록 저장 실패', saveError)
    );
  }
}
