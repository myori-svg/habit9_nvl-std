'use client';
import { Check } from 'lucide-react';
import { buildDQPrompt, parseChapters } from '@/lib/prompts';
import type { Novel } from '@/types';
import { PromptBox } from './shared';

interface Props {
  novel: Novel;
  dqChapters: string[];
  setDqChapters: React.Dispatch<React.SetStateAction<string[]>>;
  dqCustomSummary: string;
  setDqCustomSummary: React.Dispatch<React.SetStateAction<string>>;
}

export default function DQStep({
  novel,
  dqChapters,
  setDqChapters,
  dqCustomSummary,
  setDqCustomSummary,
}: Props) {
  const parsedChapters = parseChapters(novel.summary);
  const selectedSummary =
    parsedChapters.length > 0
      ? parsedChapters
          .filter((c) => dqChapters.includes(c.label))
          .map((c) => `${c.label}\n${c.content}`)
          .join('\n\n')
      : dqCustomSummary;
  const dqPrompt = buildDQPrompt(novel.title, selectedSummary);

  return (
    <div>
      {parsedChapters.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 11,
              color: 'var(--ink-soft)',
              marginBottom: 8,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
            }}
          >
            챕터 선택 (복수 선택 가능)
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              marginBottom: 12,
            }}
          >
            {parsedChapters.map((c) => {
              const sel = dqChapters.includes(c.label);
              return (
                // biome-ignore lint/a11y/noStaticElementInteractions: internal tool
                // biome-ignore lint/a11y/useKeyWithClickEvents: internal tool
                <div
                  key={c.label}
                  onClick={() =>
                    setDqChapters((prev) =>
                      sel
                        ? prev.filter((x) => x !== c.label)
                        : [...prev, c.label]
                    )
                  }
                  style={{
                    padding: '5px 12px',
                    border: '1px solid',
                    cursor: 'pointer',
                    fontSize: 12,
                    borderColor: sel ? 'var(--gold)' : 'var(--border)',
                    background: sel ? 'rgba(201,168,76,0.1)' : 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    transition: 'all 0.15s',
                  }}
                >
                  {sel && <Check size={10} style={{ color: 'var(--gold)' }} />}
                  {c.label}
                </div>
              );
            })}
          </div>
          {dqChapters.length > 0 && (
            <div
              style={{
                padding: '10px 12px',
                background: 'var(--parchment)',
                border: '1px solid var(--border)',
                fontSize: 12,
                color: 'var(--ink-soft)',
                maxHeight: 120,
                overflow: 'auto',
              }}
            >
              <pre
                style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: 12,
                }}
              >
                {selectedSummary}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 11,
              color: 'var(--ink-soft)',
              marginBottom: 6,
            }}
          >
            챕터가 자동 감지되지 않았어요. 직접 입력하세요:
          </div>
          <textarea
            className="input-field"
            value={dqCustomSummary}
            onChange={(e) => setDqCustomSummary(e.target.value)}
            placeholder="사용할 챕터 서머리를 붙여넣기"
            style={{ fontSize: 12, minHeight: 100 }}
          />
        </div>
      )}
      <PromptBox prompt={dqPrompt} label="Gemini에 붙여넣을 프롬프트" />
    </div>
  );
}
