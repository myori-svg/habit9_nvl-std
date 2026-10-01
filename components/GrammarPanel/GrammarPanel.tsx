'use client';
import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isGrammarRunStalled } from '@/lib/grammar-job';
import { useStore } from '@/lib/store';
import type { GrammarJob } from '@/types';
import GrammarForm from './GrammarForm';
import GrammarJobView from './GrammarJobView';

const CLOCK_TICK_MS = 30 * 1000;

function jobTitle(job: GrammarJob, now: number): string {
  if (job.result?.analysis.unitTitle) return job.result.analysis.unitTitle;
  if (job.run.status === 'running' && !isGrammarRunStalled(job.run, now))
    return '생성 중…';
  return job.run.status === 'done' ? '(제목 없음)' : '생성되지 않음';
}

function jobStatusLabel(job: GrammarJob, now: number): string {
  if (isGrammarRunStalled(job.run, now)) return '끊김';
  const labels = {
    running: job.result ? '다시 생성 중' : '생성 중',
    done: '완료',
    error: '실패',
    stopped: '중지됨',
  } as const;
  return labels[job.run.status];
}

export default function GrammarPanel() {
  const { grammarJobs, promptTemplates } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // 서버가 끊겼는지는 마지막 갱신 시각과 지금을 비교해 판단하므로 시계를 굴린다.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const selected =
    grammarJobs.find((job) => job.id === selectedId) ?? grammarJobs[0];

  const handleRetry = async (jobId: string) => {
    const res = await fetch('/api/grammar-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'retry',
        jobId,
        grammarTemplate: promptTemplates.grammar,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `요청이 실패했어요 (${res.status})`);
    }
  };

  const handleDelete = async (job: GrammarJob) => {
    if (!window.confirm('이 작업과 올린 파일을 지울까요?')) return;
    await fetch(`/api/grammar-job?id=${encodeURIComponent(job.id)}`, {
      method: 'DELETE',
    });
  };

  return (
    <div
      style={{
        maxWidth: 900,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      <h2
        className="serif"
        style={{ fontSize: 24, fontWeight: 300, margin: 0 }}
      >
        Grammar
      </h2>

      <GrammarForm onCreated={setSelectedId} />

      {grammarJobs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--ink-soft)',
              marginBottom: 4,
            }}
          >
            작업 목록 (생성 후 7일이 지나면 자동으로 지워져요)
          </div>
          {grammarJobs.map((job) => {
            const active = job.id === selected?.id;
            return (
              <div
                key={job.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: active ? 'rgba(201,168,76,0.18)' : 'white',
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(job.id)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '10px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {jobTitle(job, now)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                    {new Date(job.createdAt).toLocaleString('ko-KR')} ·{' '}
                    {jobStatusLabel(job, now)}
                    {job.result?.provider === 'openai' && ' · OpenAI로 생성'}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="작업 지우기"
                  onClick={() => handleDelete(job)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--crimson)',
                    opacity: 0.5,
                    padding: '10px 14px',
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <GrammarJobView
          key={selected.id}
          job={selected}
          now={now}
          onRetry={handleRetry}
        />
      )}

      <style>{`@keyframes grammar-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
