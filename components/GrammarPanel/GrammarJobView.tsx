'use client';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import {
  formatAllAnswersForCopy,
  formatAllQuestionsForCopy,
  formatQuestionForCopy,
  isGrammarRunStalled,
} from '@/lib/grammar-job';
import { useStore } from '@/lib/store';
import type { GrammarJob, GrammarQuestion } from '@/types';

const CHOICE_LETTERS = 'ABCDEFGH';

const notice = (background: string, color: string) =>
  ({
    padding: '10px 14px',
    background,
    color,
    fontSize: 12,
    lineHeight: 1.6,
  }) as const;

function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
    setTimeout(() => setState('idle'), 1800);
  };

  return (
    <button
      type="button"
      className="btn-ghost"
      onClick={handleCopy}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        padding: '6px 12px',
      }}
    >
      {state === 'copied' ? (
        <>
          <Check size={12} style={{ color: 'var(--sage)' }} /> 복사됨
        </>
      ) : state === 'failed' ? (
        <span style={{ color: 'var(--crimson)' }}>복사 실패</span>
      ) : (
        <>
          <Copy size={12} /> {label}
        </>
      )}
    </button>
  );
}

function QuestionCard({ question }: { question: GrammarQuestion }) {
  return (
    <div style={{ background: 'white', padding: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          {question.number}번
        </span>
        <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
          {question.type === 'multiple-choice' ? '객관식' : '서술형'}
        </span>
        <span style={{ flex: 1 }} />
        <CopyButton text={formatQuestionForCopy(question)} label="문제 복사" />
        <CopyButton text={question.answer} label="정답 복사" />
      </div>

      <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
        {question.question}
      </div>
      {question.choices.length > 0 && (
        <div
          style={{
            marginTop: 8,
            fontSize: 13,
            lineHeight: 1.7,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {question.choices.map((choice, i) => (
            <div key={`${CHOICE_LETTERS[i]}-${choice}`}>
              {CHOICE_LETTERS[i]}. {choice}
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          marginTop: 12,
          padding: '8px 12px',
          background: 'var(--parchment)',
          fontSize: 12,
          lineHeight: 1.7,
        }}
      >
        <div>
          <strong>정답</strong> {question.answer}
        </div>
        {question.explanation && (
          <div style={{ color: 'var(--ink-soft)' }}>{question.explanation}</div>
        )}
      </div>
    </div>
  );
}

function AnalysisSection({
  analysis,
}: {
  analysis: NonNullable<GrammarJob['result']>['analysis'];
}) {
  const rows: [string, string[]][] = [
    ['문법 범위', analysis.grammarScope ? [analysis.grammarScope] : []],
    ['꼭 구분해야 하는 것', analysis.keyContrasts],
    ['자주 하는 실수', analysis.commonMistakes],
  ];
  return (
    <div
      style={{
        background: 'var(--parchment)',
        padding: 16,
        fontSize: 12,
        lineHeight: 1.7,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
        {analysis.unitTitle || '(Unit 제목 없음)'}
      </div>
      {rows
        .filter(([, items]) => items.length > 0)
        .map(([label, items]) => (
          <div key={label} style={{ marginTop: 6 }}>
            <span style={{ color: 'var(--ink-soft)' }}>{label}</span>
            {items.map((item) => (
              <div key={item}>· {item}</div>
            ))}
          </div>
        ))}
    </div>
  );
}

export default function GrammarJobView({
  job,
  now,
  onRetry,
}: {
  job: GrammarJob;
  now: number;
  onRetry: (jobId: string) => Promise<void>;
}) {
  const { stopGrammarRun } = useStore();
  const [retrying, setRetrying] = useState(false);
  const [actionError, setActionError] = useState('');
  const { run, result, input } = job;
  const stalled = isGrammarRunStalled(run, now);
  const running = run.status === 'running' && !stalled;
  const requested = input.multipleChoiceCount + input.shortAnswerCount;

  const handleRetry = async () => {
    setActionError('');
    setRetrying(true);
    try {
      await onRetry(job.id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setRetrying(false);
    }
  };

  const retryButton = (label: string) => (
    <button
      type="button"
      className="btn-ghost"
      onClick={handleRetry}
      disabled={running || retrying}
      style={{ fontSize: 12, padding: '6px 12px', marginTop: 8 }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {running && (
        <div
          style={{
            ...notice('rgba(201,168,76,0.12)', 'var(--ink)'),
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <RefreshCw
            size={13}
            style={{
              color: 'var(--gold-dim)',
              animation: 'grammar-spin 1s linear infinite',
              flexShrink: 0,
            }}
          />
          <span style={{ flex: 1 }}>
            {result ? '다시 생성하는 중' : '생성하는 중'}이에요. 탭을 닫아도
            서버에서 계속 진행돼요.
          </span>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => stopGrammarRun(job.id)}
            style={{ fontSize: 12, padding: '6px 12px' }}
          >
            중지
          </button>
        </div>
      )}

      {stalled && (
        <div style={notice('#fff5f5', 'var(--crimson)')}>
          서버 작업이 중간에 끊긴 것 같아요.
          <div>{retryButton('다시 시작')}</div>
        </div>
      )}

      {run.status === 'stopped' && (
        <div style={notice('var(--parchment)', 'var(--ink-soft)')}>
          중지했어요.
          <div>{retryButton(result ? '다시 생성' : '생성 시작')}</div>
        </div>
      )}

      {run.status === 'error' && (
        <div style={notice('#fff5f5', 'var(--crimson)')}>
          생성에 실패했어요{result ? ' (이전 결과는 그대로 남아 있어요)' : ''}:{' '}
          {run.error}
          <div>{retryButton('다시 시도')}</div>
        </div>
      )}

      {actionError && (
        <div style={notice('#fff5f5', 'var(--crimson)')}>{actionError}</div>
      )}

      {result?.provider === 'openai' && (
        <div style={notice('rgba(201,168,76,0.18)', 'var(--ink)')}>
          <strong>OpenAI로 만든 결과예요.</strong> Gemini가 실패해서 대신
          만들었어요. 문제 스타일이 평소와 다를 수 있어요.
          {result.geminiFailure && (
            <div style={{ color: 'var(--ink-soft)', marginTop: 2 }}>
              Gemini 실패 이유: {result.geminiFailure}
            </div>
          )}
          <div>{retryButton('Gemini로 다시 생성')}</div>
        </div>
      )}

      {result && result.questions.length !== requested && (
        <div style={notice('#fff5f5', 'var(--crimson)')}>
          {requested}개를 요청했는데 {result.questions.length}개만 나왔어요.
        </div>
      )}

      {result && (
        <>
          <AnalysisSection analysis={result.analysis} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <CopyButton
              text={formatAllQuestionsForCopy(result.questions)}
              label="전체 문제 복사"
            />
            <CopyButton
              text={formatAllAnswersForCopy(result.questions)}
              label="전체 정답 복사"
            />
          </div>
          {result.questions.map((question) => (
            <QuestionCard key={question.number} question={question} />
          ))}
        </>
      )}
    </div>
  );
}
