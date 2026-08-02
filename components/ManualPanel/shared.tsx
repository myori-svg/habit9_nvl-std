'use client';
import { Check, Copy, RefreshCw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { type PromptTemplateKey, reverseTemplate } from '@/lib/prompts';
import { useStore } from '@/lib/store';
import type { Novel } from '@/types';

// ── Auto-generation per-character status list ──────────────────────
export type AutoGenState = 'pending' | 'running' | 'done' | 'error';
export interface AutoGenCharStatus {
  state: AutoGenState;
  message?: string;
}

export function AutoGenStatusList({
  chars,
  status,
  selected,
  onToggle,
  onRegenerate,
}: {
  chars: { id: string; name: string }[];
  status: Record<string, AutoGenCharStatus>;
  selected?: Record<string, boolean>;
  onToggle?: (id: string) => void;
  onRegenerate?: (id: string) => void;
}) {
  if (chars.length === 0) return null;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        marginTop: 10,
      }}
    >
      {chars.map((c) => {
        const s = status[c.id];
        if (!s) return null;
        return (
          <div
            key={c.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              padding: '5px 8px',
              background: s.state === 'error' ? '#fff5f5' : 'white',
              border: '1px solid',
              borderColor: s.state === 'error' ? '#fcc' : 'var(--border)',
            }}
          >
            {onToggle && (
              <input
                type="checkbox"
                checked={selected?.[c.id] ?? false}
                onChange={() => onToggle(c.id)}
                style={{ flexShrink: 0, cursor: 'pointer' }}
              />
            )}
            <span
              style={{
                width: 12,
                flexShrink: 0,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              {s.state === 'done' ? (
                <Check size={12} style={{ color: 'var(--sage)' }} />
              ) : s.state === 'error' ? (
                <X size={12} style={{ color: 'var(--crimson)' }} />
              ) : s.state === 'running' ? (
                <RefreshCw
                  size={12}
                  style={{
                    color: 'var(--gold)',
                    animation: 'spin 1s linear infinite',
                  }}
                />
              ) : null}
            </span>
            <span style={{ fontWeight: 500, flexShrink: 0 }}>{c.name}</span>
            <span
              style={{
                color:
                  s.state === 'error' ? 'var(--crimson)' : 'var(--ink-soft)',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {s.message ??
                (s.state === 'done'
                  ? '생성 완료!'
                  : s.state === 'running'
                    ? '생성 중…'
                    : '대기 중')}
            </span>
            {s.state === 'done' && onRegenerate && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => onRegenerate(c.id)}
                style={{ fontSize: 11, padding: '3px 8px', flexShrink: 0 }}
              >
                재생성
              </button>
            )}
          </div>
        );
      })}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function CopyButton({
  onCopy,
  copied,
}: {
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      className="btn-ghost"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        padding: '6px 12px',
      }}
    >
      {copied ? (
        <>
          <Check size={12} style={{ color: 'var(--sage)' }} /> Copied!
        </>
      ) : (
        <>
          <Copy size={12} /> Copy
        </>
      )}
    </button>
  );
}

function SaveTemplateButton({
  onSave,
  saved,
  disabled,
}: {
  onSave: () => void;
  saved: boolean;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSave}
      disabled={disabled}
      className="btn-ghost"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        padding: '6px 12px',
      }}
    >
      {saved ? (
        <>
          <Check size={12} style={{ color: 'var(--sage)' }} /> Saved!
        </>
      ) : (
        '템플릿으로 저장'
      )}
    </button>
  );
}

export function PromptBox({
  prompt,
  label,
  templateKey,
  vars,
}: {
  prompt: string;
  label?: string;
  // 지정하면 편집한 프롬프트를 "템플릿으로 저장" 가능해짐
  templateKey?: PromptTemplateKey;
  vars?: Record<string, string>;
}) {
  const { savePromptTemplate } = useStore();
  const [copied, setCopied] = useState(false);
  const [value, setValue] = useState(prompt);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  // 원본 prompt가 바뀌면 (다른 소설/캐릭터 선택 등) 편집 내용을 최신 값으로 리셋
  useEffect(() => {
    setValue(prompt);
  }, [prompt]);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSaveTemplate = async () => {
    if (!templateKey) return;
    // reverseTemplate은 값이 빈 문자열인 변수는 되돌리지 못하고 건너뛴다.
    // 그 상태에서 저장하면 렌더링된 placeholder 텍스트가 {{var}} 자리
    // 대신 리터럴로 굳어버려, 이후 챕터/캐릭터를 선택해도 값이 반영되지
    // 않는 문제가 생긴다 (예: 챕터 미선택 상태로 DQ 템플릿을 저장한 경우).
    // 값이 비어있는 변수가 있으면 저장을 막는다.
    const emptyVarKeys = Object.entries(vars ?? {})
      .filter(([, v]) => !v)
      .map(([k]) => k);
    if (emptyVarKeys.length > 0) {
      setSaveError(
        `아직 값이 채워지지 않은 항목이 있어 템플릿으로 저장할 수 없어요 (${emptyVarKeys.join(', ')}). 내용을 먼저 채운 뒤 다시 시도해주세요.`
      );
      setTimeout(() => setSaveError(''), 4000);
      return;
    }
    const template = reverseTemplate(value, vars ?? {});
    await savePromptTemplate(templateKey, template);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'var(--ink-soft)',
            marginBottom: 6,
          }}
        >
          {label}
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="input-field"
          style={{
            background: 'var(--parchment)',
            padding: '14px 16px',
            fontSize: 12,
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: 0,
            height: 300,
            width: '100%',
            resize: 'vertical',
            fontFamily: 'DM Sans, sans-serif',
            boxSizing: 'border-box',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            gap: 6,
          }}
        >
          {templateKey && (
            <SaveTemplateButton
              onSave={handleSaveTemplate}
              saved={saved}
              disabled={!value.trim()}
            />
          )}
          <CopyButton onCopy={handleCopy} copied={copied} />
        </div>
      </div>

      {saveError && (
        <div
          style={{
            marginTop: 8,
            padding: '8px 12px',
            background: '#fff5f5',
            border: '1px solid #fcc',
            fontSize: 12,
            color: 'var(--crimson)',
          }}
        >
          {saveError}
        </div>
      )}

      {copied && (
        // biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss overlay, not a keyboard-operable widget
        // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss overlay, not a keyboard-operable widget
        <div
          onClick={() => setCopied(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(26,20,16,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {/* biome-ignore lint/a11y/noStaticElementInteractions: stops backdrop click from bubbling, not itself interactive */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: stops backdrop click from bubbling, not itself interactive */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--parchment)',
              border: '1px solid var(--border)',
              padding: '40px 48px',
              maxWidth: 420,
              width: '90%',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              animation: 'slideUp 0.2s ease',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(74,103,65,0.12)',
                border: '1px solid var(--sage)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <Check size={22} style={{ color: 'var(--sage)' }} />
            </div>
            <p
              className="serif"
              style={{ fontSize: 22, fontWeight: 300, margin: '0 0 8px' }}
            >
              클립보드에 복사됐어요!
            </p>
            <p
              style={{
                fontSize: 13,
                color: 'var(--ink-soft)',
                margin: '0 0 28px',
              }}
            >
              Gemini에 붙여넣고 결과를 받아오세요.
            </p>
            <button
              type="button"
              onClick={() => setCopied(false)}
              className="btn-primary"
              style={{ fontSize: 13, padding: '10px 28px' }}
            >
              확인
            </button>
          </div>
        </div>
      )}
      <style>{`
				@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
				@keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
			`}</style>
    </div>
  );
}

const saveBoxStyle = {
  marginTop: 20,
  padding: 16,
  background: 'var(--parchment)',
  border: '1px solid var(--border)',
} as const;

const saveLabelStyle = {
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-soft)',
  marginBottom: 10,
};

function SaveButton({ saved }: { saved: boolean }) {
  return saved ? (
    <>
      <Check size={12} /> Saved!
    </>
  ) : (
    <>저장</>
  );
}

// ② 구도 프롬프트 결과 일괄 저장
export function SaveCompositionBox({
  novel,
  compPartId,
}: {
  novel: Novel;
  compPartId: string;
}) {
  const { updateDQ } = useStore();
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);

  const part = novel.parts.find((p) => p.id === compPartId);
  if (!part || part.discussionQuestions.length === 0) return null;

  // === 구분자로 자동 파싱
  const parsed = value.trim()
    ? value
        .split(/\n*===\n*/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const dqs = part.discussionQuestions;
  const countMatch = parsed.length === dqs.length;

  const handleSaveAll = async () => {
    for (let i = 0; i < dqs.length; i++) {
      if (parsed[i]) {
        await updateDQ(novel.id, compPartId, dqs[i].id, {
          compositionPrompt: parsed[i],
        });
      }
    }
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setValue('');
    }, 1500);
  };

  return (
    <div style={saveBoxStyle}>
      <div style={saveLabelStyle}>구도 프롬프트 일괄 저장</div>
      <p
        style={{
          fontSize: 11,
          color: 'var(--ink-soft)',
          margin: '0 0 10px',
          lineHeight: 1.6,
        }}
      >
        Gemini 결과 전체를 붙여넣으면 <code>===</code> 구분자 기준으로 자동
        분할해서 각 DQ에 저장합니다.
      </p>
      <textarea
        className="input-field"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`Gemini 결과 전체 붙여넣기\n(=== 구분선 포함)`}
        style={{ fontSize: 12, minHeight: 120, marginBottom: 10 }}
      />

      {parsed.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {!countMatch && (
            <div
              style={{
                fontSize: 11,
                color: 'var(--crimson)',
                marginBottom: 8,
                padding: '6px 10px',
                background: '#fff5f5',
                border: '1px solid #fcc',
              }}
            >
              ⚠ 분할된 항목 {parsed.length}개 / DQ {dqs.length}개 — 수가 맞지
              않아요
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {dqs.map((dq, i) => (
              <div
                key={dq.id}
                style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    fontSize: 11,
                    fontWeight: 600,
                    color: parsed[i] ? 'var(--sage)' : 'var(--ink-soft)',
                    paddingTop: 5,
                    width: 28,
                  }}
                >
                  Q{i + 1}
                </div>
                <div
                  style={{
                    flex: 1,
                    padding: '5px 8px',
                    fontSize: 11,
                    lineHeight: 1.5,
                    color: 'var(--ink-soft)',
                    background: parsed[i] ? 'rgba(74,103,65,0.06)' : 'white',
                    border: '1px solid',
                    borderColor: parsed[i] ? 'var(--sage)' : 'var(--border)',
                    maxHeight: 56,
                    overflow: 'hidden',
                  }}
                >
                  {parsed[i] ? (
                    parsed[i].slice(0, 100) +
                    (parsed[i].length > 100 ? '…' : '')
                  ) : (
                    <span style={{ opacity: 0.4 }}>(매칭 없음)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {parsed.length > 0 && (
        <button
          type="button"
          className="btn-primary"
          onClick={handleSaveAll}
          disabled={!countMatch || saved}
          style={{
            fontSize: 12,
            padding: '7px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <SaveButton saved={saved} />
        </button>
      )}
    </div>
  );
}

// ③-1 캐릭터 정보 결과 저장
export function SaveCharInfoBox({ novel }: { novel: Novel }) {
  const { updateCharacter } = useStore();
  const [charName, setCharName] = useState(novel.characters[0]?.name ?? '');
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);

  if (novel.characters.length === 0) return null;

  const handleSave = () => {
    if (!value.trim()) return;
    const char = novel.characters.find((c) => c.name === charName);
    if (char) updateCharacter(novel.id, char.id, { info: value.trim() });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setValue('');
    }, 1500);
  };

  return (
    <div style={saveBoxStyle}>
      <div style={saveLabelStyle}>캐릭터 정보 저장</div>
      <select
        value={charName}
        onChange={(e) => setCharName(e.target.value)}
        className="input-field"
        style={{ fontSize: 12, marginBottom: 8 }}
      >
        {novel.characters.map((c) => (
          <option key={c.id} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>
      <textarea
        className="input-field"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Gemini에서 생성된 캐릭터 정보를 붙여넣기"
        style={{ fontSize: 12, minHeight: 80, marginBottom: 8 }}
      />
      <button
        type="button"
        className="btn-primary"
        onClick={handleSave}
        disabled={!value.trim()}
        style={{
          fontSize: 12,
          padding: '7px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <SaveButton saved={saved} />
      </button>
    </div>
  );
}

// ③-2 캐릭터 프롬프트 결과 저장
export function SaveCharPromptBox({
  novel,
  charName,
}: {
  novel: Novel;
  charName: string;
}) {
  const { updateCharacter } = useStore();
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (!value.trim()) return;
    const char = novel.characters.find((c) => c.name === charName);
    if (char) updateCharacter(novel.id, char.id, { textPrompt: value.trim() });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setValue('');
    }, 1500);
  };

  return (
    <div style={saveBoxStyle}>
      <div style={saveLabelStyle}>캐릭터 프롬프트 저장</div>
      <textarea
        className="input-field"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Gemini에서 생성된 캐릭터 프롬프트를 붙여넣기"
        style={{ fontSize: 12, minHeight: 80, marginBottom: 8 }}
      />
      <button
        type="button"
        className="btn-primary"
        onClick={handleSave}
        disabled={!value.trim()}
        style={{
          fontSize: 12,
          padding: '7px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <SaveButton saved={saved} />
      </button>
    </div>
  );
}
