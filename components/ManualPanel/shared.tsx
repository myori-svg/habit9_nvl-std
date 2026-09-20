'use client';
import { Check, Copy, RefreshCw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  normalizeCharacterNames,
  splitQuestionBlocks,
} from '@/lib/output-format';
import {
  DEFAULT_PROMPT_TEMPLATES,
  getPromptedCharacterNames,
  type PromptTemplateKey,
  TEMPLATE_VARIABLES,
  validatePromptTemplate,
} from '@/lib/prompts';
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

// 저장된 커스텀 템플릿에 필수 자리표시자가 없어서 기본 템플릿으로 대체 중임을 알린다.
export function TemplateFallbackNotice({
  templateName,
  missing,
}: {
  templateName: string;
  missing: string[];
}) {
  if (missing.length === 0) return null;
  return (
    <div
      style={{
        marginBottom: 12,
        padding: '10px 14px',
        background: '#fff5f5',
        fontSize: 12,
        lineHeight: 1.6,
        color: 'var(--crimson)',
      }}
    >
      저장된 {templateName} 템플릿에 {missing.map((m) => `{{${m}}}`).join(', ')}{' '}
      자리가 없어서, 지금은 기본 템플릿으로 대신 만들고 있어요.
    </div>
  );
}

// 저장된 템플릿을 {{자리표시자}}가 보이는 원본 그대로 편집한다. 화면에 조립된
// 프롬프트에서 자리표시자를 역추적하지 않고 입력한 원본을 그대로 저장하며, 필수
// 자리표시자가 빠졌거나 정의되지 않은 자리표시자가 있으면 저장하지 못한다.
function TemplateEditor({ templateKey }: { templateKey: PromptTemplateKey }) {
  const { promptTemplates, savePromptTemplate, resetPromptTemplate } =
    useStore();
  const stored = promptTemplates[templateKey];
  const base = stored ?? DEFAULT_PROMPT_TEMPLATES[templateKey];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(base);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(base);
  }, [base]);

  const { missing, unknown } = validatePromptTemplate(templateKey, draft);
  const canSave =
    draft.trim() !== '' &&
    draft !== base &&
    missing.length === 0 &&
    unknown.length === 0;
  const formatManagedByCode =
    templateKey === 'dq' || templateKey === 'composition';

  const handleSave = async () => {
    setError('');
    try {
      await savePromptTemplate(templateKey, draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleReset = async () => {
    if (!window.confirm('저장된 양식을 지우고 기본 양식으로 되돌릴까요?'))
      return;
    setError('');
    try {
      await resetPromptTemplate(templateKey);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        className="btn-ghost"
        onClick={() => setOpen((v) => !v)}
        style={{ fontSize: 12, padding: '6px 12px' }}
      >
        {open ? '양식 편집 닫기' : '양식 편집'}
      </button>
      {open && (
        <div
          style={{
            marginTop: 8,
            padding: 16,
            background: 'var(--parchment)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div
            style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--ink-soft)' }}
          >
            여기서 저장한 양식은 모든 소설에 공통으로 적용돼요.
            {formatManagedByCode &&
              ' 출력 형식(구분선·코드블럭 등)은 코드가 프롬프트 뒤에 자동으로 붙이니 여기에는 적지 않아도 돼요.'}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              fontSize: 12,
              color: 'var(--ink-soft)',
            }}
          >
            {TEMPLATE_VARIABLES[templateKey].map((v) => (
              <div key={v.name}>
                <code>{`{{${v.name}}}`}</code> — {v.label}
                {v.required && (
                  <span style={{ color: 'var(--crimson)' }}> · 필수</span>
                )}
              </div>
            ))}
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="input-field"
            style={{
              fontSize: 12,
              lineHeight: 1.7,
              height: 260,
              width: '100%',
              resize: 'vertical',
              fontFamily: 'DM Sans, sans-serif',
              boxSizing: 'border-box',
            }}
          />
          {missing.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--crimson)' }}>
              필수 자리표시자가 빠졌어요:{' '}
              {missing.map((m) => `{{${m}}}`).join(', ')}
            </div>
          )}
          {unknown.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--crimson)' }}>
              알 수 없는 자리표시자예요 (오타인지 확인해주세요):{' '}
              {unknown.map((m) => `{{${m}}}`).join(', ')}
            </div>
          )}
          {error && (
            <div style={{ fontSize: 12, color: 'var(--crimson)' }}>{error}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSave}
              disabled={!canSave}
              style={{ fontSize: 12, padding: '7px 16px' }}
            >
              {saved ? 'Saved!' : '양식 저장'}
            </button>
            {stored !== undefined && (
              <button
                type="button"
                className="btn-ghost"
                onClick={handleReset}
                style={{ fontSize: 12, padding: '7px 16px' }}
              >
                기본 양식으로 되돌리기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function PromptBox({
  prompt,
  label,
  templateKey,
  appendix,
}: {
  prompt: string;
  label?: string;
  // 지정하면 프롬프트 아래에 해당 템플릿의 원본 편집 화면이 붙는다. 위 텍스트 상자의
  // 수정은 이번 복사에만 쓰이고 템플릿에는 저장되지 않는다.
  templateKey?: PromptTemplateKey;
  // 템플릿과 별개로 코드가 소유하는 출력 형식 안내. 복사할 때 프롬프트 뒤에
  // 붙고, 편집·템플릿 저장 대상이 아니다.
  appendix?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [value, setValue] = useState(prompt);

  // 원본 prompt가 바뀌면 (다른 소설/캐릭터 선택 등) 편집 내용을 최신 값으로 리셋
  useEffect(() => {
    setValue(prompt);
  }, [prompt]);

  const handleCopy = () => {
    navigator.clipboard.writeText(appendix ? `${value}\n\n${appendix}` : value);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
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
          <CopyButton onCopy={handleCopy} copied={copied} />
        </div>
      </div>

      {appendix && (
        <div style={{ marginTop: 8 }}>
          <div
            style={{
              fontSize: 11,
              color: 'var(--ink-soft)',
              marginBottom: 4,
            }}
          >
            출력 형식 — 복사할 때 프롬프트 뒤에 자동으로 함께 들어가요
          </div>
          <pre
            style={{
              margin: 0,
              padding: '12px 16px',
              background: 'var(--cream)',
              color: 'var(--ink-soft)',
              fontSize: 11,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            {appendix}
          </pre>
        </div>
      )}

      {templateKey && <TemplateEditor templateKey={templateKey} />}

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

  // === 구분자로 자동 파싱. 프롬프트가 등록된 캐릭터는 등록된 이름 그대로 저장한다.
  const promptedNames = getPromptedCharacterNames(novel.characters);
  const parsed = splitQuestionBlocks(value).map((item) =>
    normalizeCharacterNames(item, promptedNames)
  );

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
