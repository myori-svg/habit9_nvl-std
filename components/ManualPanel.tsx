'use client';
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { Novel, NovelPart, DiscussionQuestion } from '@/types';
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';

interface Props { novel: Novel; }

type ActiveStep = 'dq' | 'composition' | 'char-info' | 'char-prompt' | 'scene';

const STEPS = [
  { id: 'dq', label: '① DQ 생성', desc: 'Discussion Question 생성 프롬프트' },
  { id: 'composition', label: '② 구도 프롬프트', desc: '장면 구도 생성 프롬프트' },
  { id: 'char-info', label: '③ 캐릭터 정보', desc: '캐릭터 외형/성격 정보 수집 프롬프트' },
  { id: 'char-prompt', label: '④ 캐릭터 텍스트 프롬프트', desc: '이미지 생성용 텍스트 프롬프트 작성' },
  { id: 'scene', label: '⑤ 장면 생성', desc: '최종 장면 이미지 생성 프롬프트 조립' },
] as const;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="btn-ghost"
      style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 12px' }}
    >
      {copied ? <><Check size={12} style={{ color: 'var(--sage)' }} /> Copied!</> : <><Copy size={12} /> Copy</>}
    </button>
  );
}

function PromptBox({ prompt, label }: { prompt: string; label?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <div style={{ fontSize: 11, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 6 }}>
          {label}
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <pre style={{
          background: 'var(--parchment)', border: '1px solid var(--border)',
          padding: '14px 16px', fontSize: 12, lineHeight: 1.7,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
          maxHeight: 300, overflow: 'auto', fontFamily: 'DM Sans, sans-serif',
        }}>
          {prompt}
        </pre>
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <CopyButton text={prompt} />
        </div>
      </div>
    </div>
  );
}

// ── Step components ──────────────────────────────────────────────
function StepDQ({ novel }: { novel: Novel }) {
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [customSummary, setCustomSummary] = useState('');

  useEffect(() => {
  setSelectedChapters([]);
  setCustomSummary('');
}, [novel.id]);

  // summary에서 챕터 파싱 (Chapter X-Y 또는 챕터 X 패턴)
  const parsedChapters = (() => {
    if (!novel.summary) return [];
    const lines = novel.summary.split('\n');
    const chapters: { label: string; content: string }[] = [];
    let current: { label: string; lines: string[] } | null = null;

    for (const line of lines) {
      if (/^(chapter|챕터|ch\.?)\s*[\d\-]+/i.test(line.trim())) {
        if (current) chapters.push({ label: current.label, content: current.lines.join('\n').trim() });
        current = { label: line.trim(), lines: [] };
      } else if (current) {
        current.lines.push(line);
      }
    }
    if (current) chapters.push({ label: current.label, content: current.lines.join('\n').trim() });
    return chapters;
  })();

  const toggleChapter = (label: string) =>
    setSelectedChapters((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label]
    );

  const selectedSummary = parsedChapters.length > 0
    ? parsedChapters
        .filter((c) => selectedChapters.includes(c.label))
        .map((c) => `${c.label}\n${c.content}`)
        .join('\n\n')
    : customSummary;

  const prompt = `소설 "${novel.title}"의 챕터별 서머리를 보고 각 챕터에 맞는 Discussion Question을 생성해주세요.

아래 지침을 따라주세요:
- 초등학교 4학년 영어 학습자 수준에 맞게 작성
- 선택형 또는 의견이 갈리는 형식으로 구성 (문제 + 선택지 2~3개)
- 각 챕터당 2-3개 질문
- 영어로 작성
- 각 질문(문제+선택지 포함)은 --- 구분선으로 나눌 것
- 마크다운 외 다른 태그 없이 plain text로 반환

소설 서머리:
${selectedSummary || '(챕터를 선택하거나 직접 입력해주세요)'}`;

  return (
    <div>
      {parsedChapters.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 8, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            챕터 선택 (복수 선택 가능)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {parsedChapters.map((c) => {
              const sel = selectedChapters.includes(c.label);
              return (
                <div
                  key={c.label}
                  onClick={() => toggleChapter(c.label)}
                  style={{
                    padding: '5px 12px', border: '1px solid', cursor: 'pointer', fontSize: 12,
                    borderColor: sel ? 'var(--gold)' : 'var(--border)',
                    background: sel ? 'rgba(201,168,76,0.1)' : 'white',
                    display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
                  }}
                >
                  {sel && <Check size={10} style={{ color: 'var(--gold)' }} />}
                  {c.label}
                </div>
              );
            })}
          </div>
          {selectedChapters.length > 0 && (
            <div style={{ padding: '10px 12px', background: 'var(--parchment)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--ink-soft)', maxHeight: 120, overflow: 'auto' }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'DM Sans, sans-serif', fontSize: 12 }}>
                {selectedSummary}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 6 }}>
            챕터가 자동 감지되지 않았어요. 직접 입력하세요:
          </div>
          <textarea
            className="input-field"
            value={customSummary}
            onChange={(e) => setCustomSummary(e.target.value)}
            placeholder="사용할 챕터 서머리를 붙여넣기"
            style={{ fontSize: 12, minHeight: 100 }}
          />
        </div>
      )}
      <PromptBox prompt={prompt} label="Gemini에 붙여넣을 프롬프트" />
    </div>
  );
}

function StepComposition({ novel }: { novel: Novel }) {
  const [selectedPartId, setSelectedPartId] = useState(novel.parts[0]?.id ?? '');
  const [selectedDQId, setSelectedDQId] = useState('');
  const [customDQ, setCustomDQ] = useState('');

  const part = novel.parts.find((p) => p.id === selectedPartId);
  const dq = part?.discussionQuestions.find((d) => d.id === selectedDQId);
  const questionText = dq?.text || customDQ;

  const charList = novel.characters.map((c) => c.name).join(', ') || '(캐릭터 없음)';

  const questionItems = (() => {
  if (novel.parts.length > 0 && part) {
    return part.discussionQuestions
      .map((dq) => {
        // --- 기준으로 쪼개서 각각 <div> 감싸기
        const items = dq.text.split(/\n---\n/).map((s) => s.trim()).filter(Boolean);
        if (items.length > 1) {
          return items.map((item) => `<div>\n${item}\n</div>`).join(' .');
        }
        return `<div>\n${dq.text}\n</div>`;
      })
      .join(' .');
  }
  if (customDQ) {
    const items = customDQ.split(/\n---\n/).map((s) => s.trim()).filter(Boolean);
    return items.map((item) => `<div>\n${item}\n</div>`).join(' .');
  }
  return '(질문을 선택하거나 입력해주세요)';
})();

  const prompt = `각 <항목>별로 어울리는 배경화면을 생성할 수 있도록 화풍, 캐릭터 외형을 제외한 장면의 구도를 나타내는 이미지 생성 프롬프트를 생성해줘
항목은 <div> html 태그 표시로 구분
내용에 알맞게 캐릭터들의 구도도 설정하는데, 어떤 캐릭터가 어떤 구도를 잡고 있는지 명시할 것
캐릭터명은 {}으로 감싸고, 어떤 캐릭터들이 등장하는지 각 항목 답변 제일 앞에 모아서 알려줄 것, 단 주어진 [character list]에 캐릭터명이 존재하는 경우에만 모아서 반환

[character list]
${charList}

${questionItems}`;

  return (
    <div>
      {novel.parts.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <select
              value={selectedPartId}
              onChange={(e) => { setSelectedPartId(e.target.value); setSelectedDQId(''); }}
              className="input-field"
              style={{ flex: 1, fontSize: 12 }}
            >
              {novel.parts.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 4 }}>또는 직접 입력:</div>
          <textarea
            className="input-field"
            value={customDQ}
            onChange={(e) => { setCustomDQ(e.target.value); setSelectedDQId(''); }}
            placeholder="DQ를 직접 입력하거나 위에서 선택하세요"
            style={{ fontSize: 12, minHeight: 60 }}
          />
        </div>
      ) : (
        <textarea
          className="input-field"
          value={customDQ}
          onChange={(e) => setCustomDQ(e.target.value)}
          placeholder="Discussion Question을 입력하세요"
          style={{ fontSize: 12, minHeight: 60, marginBottom: 16 }}
        />
      )}
      <PromptBox prompt={prompt} label="Gemini에 붙여넣을 프롬프트" />
    </div>
  );
}


function StepCharInfo({ novel }: { novel: Novel }) {
  const [charName, setCharName] = useState(novel.characters[0]?.name ?? '');

  const prompt = `소설 "${novel.title}"에 등장하는 캐릭터 "${charName || '(캐릭터 이름)'}"의 정보를 정리해주세요.

아래 내용을 포함해주세요:
- 나이 및 신체적 외형 (머리카락, 눈, 체형, 주로 입는 옷)
- 성격 특징
- 이야기에서의 역할

외형 묘사는 구체적으로. 150단어 이내.`;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        {novel.characters.length > 0 ? (
          <select
            value={charName}
            onChange={(e) => setCharName(e.target.value)}
            className="input-field"
            style={{ fontSize: 12 }}
          >
            {novel.characters.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        ) : (
          <input
            className="input-field"
            value={charName}
            onChange={(e) => setCharName(e.target.value)}
            placeholder="캐릭터 이름 입력"
            style={{ fontSize: 12 }}
          />
        )}
      </div>
      <PromptBox prompt={prompt} label="Gemini에 붙여넣을 프롬프트" />
    </div>
  );
}

function StepCharPrompt({ novel }: { novel: Novel }) {
  const [charName, setCharName] = useState(novel.characters[0]?.name ?? '');
  const char = novel.characters.find((c) => c.name === charName);
  const [charInfo, setCharInfo] = useState(char?.info ?? '');
  const styleRef = novel.stylePrompt || 'cozy heartwarming watercolor and colored pencil storybook illustration, soft hand-drawn outlines, warm golden light, muted pastels and earthy browns, framed by a decorative vine border';

  const prompt = `아래 조건에 따라 캐릭터의 외형을 잘 드러나는 이미지 텍스트 프롬프트를 생성해주세요.

- Full-body storybook illustration
- 외형, 의상, 성격이 드러나는 표정과 포즈 묘사
- 성격 정보를 표정에 반영할 것
- 아래 스타일을 따를 것

<image style>
${styleRef}

<character info>
캐릭터명: ${charName || '(이름)'}
${charInfo || '(캐릭터 정보를 입력하거나 위에서 선택하세요)'}

프롬프트 텍스트만 출력. 영어로 작성.`;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {novel.characters.length > 0 ? (
          <select
            value={charName}
            onChange={(e) => {
              setCharName(e.target.value);
              const c = novel.characters.find((ch) => ch.name === e.target.value);
              setCharInfo(c?.info ?? '');
            }}
            className="input-field"
            style={{ fontSize: 12, flex: 1 }}
          >
            {novel.characters.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        ) : (
          <input className="input-field" value={charName} onChange={(e) => setCharName(e.target.value)} placeholder="캐릭터 이름" style={{ fontSize: 12, flex: 1 }} />
        )}
      </div>
      <textarea
        className="input-field"
        value={charInfo}
        onChange={(e) => setCharInfo(e.target.value)}
        placeholder="캐릭터 정보 (③에서 Gemini가 생성한 결과 붙여넣기)"
        style={{ fontSize: 12, minHeight: 80, marginBottom: 12 }}
      />
      <PromptBox prompt={prompt} label="Gemini에 붙여넣을 프롬프트" />
    </div>
  );
}

function StepScene({ novel }: { novel: Novel }) {
  const [selectedPartId, setSelectedPartId] = useState(novel.parts[0]?.id ?? '');
  const [selectedDQId, setSelectedDQId] = useState('');
  const [composition, setComposition] = useState('');
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);

  const part = novel.parts.find((p) => p.id === selectedPartId);
  const dq = part?.discussionQuestions.find((d) => d.id === selectedDQId);

    // 구도 프롬프트에서 {캐릭터명} 자동 감지
  useEffect(() => {
    if (!composition) return;
    const matches = composition.match(/\{([^}]+)\}/g)?.map((m) => m.slice(1, -1)) ?? [];
    const autoIds = novel.characters
      .filter((c) => matches.some((m) => m.toLowerCase() === c.name.toLowerCase()))
      .map((c) => c.id);
    if (autoIds.length > 0) setSelectedCharIds(autoIds);
  }, [composition]);
  

  // Auto-fill composition when DQ selected
  const handleDQSelect = (dqId: string) => {
    setSelectedDQId(dqId);
    const selected = part?.discussionQuestions.find((d) => d.id === dqId);
    if (selected?.compositionPrompt) setComposition(selected.compositionPrompt);
  };

  const toggleChar = (id: string) =>
    setSelectedCharIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const selectedChars = novel.characters.filter((c) => selectedCharIds.includes(c.id));
  const charPromptsText = selectedChars
    .map((c) => `{${c.name}}: ${c.textPrompt || '(텍스트 프롬프트 없음 — ④ 단계에서 생성 필요)'}`)
    .join('\n\n');

  const styleRef = novel.stylePrompt || 'A heartwarming watercolor and colored pencil storybook illustration. Muted pastels and earthy browns with delicate hand-drawn outlines. The image is framed by a decorative vine border.';

  const prompt = `아래 지시 사항에 따라 이미지를 생성해주세요.

- 스타일은 <image style>을 따를 것${novel.styleImageBase64 ? ' (스타일 참고 이미지도 함께 제공)' : ''}
- 캐릭터는 <character prompt>에 따라 묘사하고, 캐릭터명은 {}로 구분
- 구도는 <composition>을 따를 것
- 표정은 역동적으로
- 이미지 비율: 16:9

<image style>
${styleRef}

<composition>
${composition || '(구도 프롬프트를 입력하거나 위에서 DQ를 선택하세요)'}

<character prompt>
${charPromptsText || '(캐릭터를 선택하세요)'}`;

  return (
    <div>
      {/* Part/DQ selector */}
      {novel.parts.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <select value={selectedPartId} onChange={(e) => { setSelectedPartId(e.target.value); setSelectedDQId(''); setComposition(''); }} className="input-field" style={{ flex: 1, fontSize: 12 }}>
            {novel.parts.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <select value={selectedDQId} onChange={(e) => handleDQSelect(e.target.value)} className="input-field" style={{ flex: 2, fontSize: 12 }}>
            <option value="">— DQ 선택 (구도 자동 입력) —</option>
            {part?.discussionQuestions.map((dq, i) => (
              <option key={dq.id} value={dq.id}>Q{i + 1}. {dq.text.slice(0, 40)}…</option>
            ))}
          </select>
        </div>
      )}

      {/* Composition prompt */}
      <textarea
        className="input-field"
        value={composition}
        onChange={(e) => setComposition(e.target.value)}
        placeholder="구도 프롬프트 (②에서 Gemini가 생성한 결과 붙여넣기, 또는 DQ 선택 시 자동 입력)"
        style={{ fontSize: 12, minHeight: 80, marginBottom: 12 }}
      />

      {/* Character selector */}
      {novel.characters.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 6, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            등장 캐릭터 선택
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {novel.characters.map((c) => {
              const sel = selectedCharIds.includes(c.id);
              return (
                <div key={c.id} onClick={() => toggleChar(c.id)} style={{
                  padding: '5px 12px', border: '1px solid', cursor: 'pointer', fontSize: 12,
                  borderColor: sel ? 'var(--gold)' : 'var(--border)',
                  background: sel ? 'rgba(201,168,76,0.1)' : 'white',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  {sel && <Check size={10} style={{ color: 'var(--gold)' }} />}
                  {c.name}
                  {!c.textPrompt && <span style={{ fontSize: 10, color: 'var(--crimson)', opacity: 0.7 }}>프롬프트 없음</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <PromptBox prompt={prompt} label="Gemini에 붙여넣을 최종 장면 생성 프롬프트" />

      {/* Manual result paste back */}
      <ManualResultPaste novel={novel} selectedPartId={selectedPartId} selectedDQId={selectedDQId} />
    </div>
  );
}

// Paste back generated composition prompt result
function ManualResultPaste({ novel, selectedPartId, selectedDQId }: { novel: Novel; selectedPartId: string; selectedDQId: string }) {
  const { updateDQ, updateCharacter } = useStore();
  const [tab, setTab] = useState<'composition' | 'charPrompt' | 'charInfo'>('composition');
  const [value, setValue] = useState('');
  const [charName, setCharName] = useState(novel.characters[0]?.name ?? '');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (!value.trim()) return;
    if (tab === 'composition' && selectedPartId && selectedDQId) {
      updateDQ(novel.id, selectedPartId, selectedDQId, { compositionPrompt: value.trim() });
    } else if (tab === 'charPrompt') {
      const char = novel.characters.find((c) => c.name === charName);
      if (char) updateCharacter(novel.id, char.id, { textPrompt: value.trim() });
    } else if (tab === 'charInfo') {
      const char = novel.characters.find((c) => c.name === charName);
      if (char) updateCharacter(novel.id, char.id, { info: value.trim() });
    }
    setSaved(true);
    setTimeout(() => { setSaved(false); setValue(''); }, 1500);
  };

  return (
    <div style={{ marginTop: 20, padding: 16, background: 'var(--parchment)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 10 }}>
        Gemini 결과 저장하기
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {(['composition', 'charInfo', 'charPrompt'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '4px 10px', fontSize: 11, cursor: 'pointer',
            background: tab === t ? 'var(--ink)' : 'white',
            color: tab === t ? 'var(--parchment)' : 'var(--ink-soft)',
            border: '1px solid', borderColor: tab === t ? 'var(--ink)' : 'var(--border)',
          }}>
            {t === 'composition' ? '구도 프롬프트' : t === 'charInfo' ? '캐릭터 정보' : '캐릭터 텍스트 프롬프트'}
          </button>
        ))}
      </div>

      {(tab === 'charInfo' || tab === 'charPrompt') && novel.characters.length > 0 && (
        <select value={charName} onChange={(e) => setCharName(e.target.value)} className="input-field" style={{ fontSize: 12, marginBottom: 8 }}>
          {novel.characters.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      )}

      <textarea
        className="input-field"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Gemini에서 생성된 결과를 여기에 붙여넣기"
        style={{ fontSize: 12, minHeight: 80, marginBottom: 8 }}
      />
      <button className="btn-primary" onClick={handleSave} disabled={!value.trim()} style={{ fontSize: 12, padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
        {saved ? <><Check size={12} /> Saved!</> : '저장'}
      </button>
    </div>
  );
}

// ── Main ManualPanel ─────────────────────────────────────────────

export default function ManualPanel({ novel }: Props) {
  const [activeStep, setActiveStep] = useState<ActiveStep>('dq');
  const [activeNovelKey, setActiveNovelKey] = useState(novel.id);

  useEffect(() => {
    setActiveNovelKey(novel.id);
    setActiveStep('dq');
  }, [novel.id]);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 className="serif" style={{ fontSize: 26, fontWeight: 300, margin: '0 0 6px' }}>
          Manual Mode — {novel.title}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, opacity: 0.7 }}>
          각 단계의 프롬프트를 복사해서 Gemini에 직접 붙여넣고, 결과를 다시 저장할 수 있어요.
        </p>
      </div>

      {/* Step tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {STEPS.map((step) => (
          <button
            key={step.id}
            onClick={() => setActiveStep(step.id as ActiveStep)}
            style={{
              padding: '8px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              background: activeStep === step.id ? 'var(--ink)' : 'white',
              color: activeStep === step.id ? 'var(--parchment)' : 'var(--ink-soft)',
              border: '1px solid', borderColor: activeStep === step.id ? 'var(--ink)' : 'var(--border)',
              transition: 'all 0.15s',
            }}
          >
            {step.label}
          </button>
        ))}
      </div>

      {/* Step description */}
      <div style={{ padding: '10px 14px', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', marginBottom: 20, fontSize: 12, color: 'var(--ink-soft)' }}>
        {STEPS.find((s) => s.id === activeStep)?.desc}
      </div>

      {/* Step content */}
      <div className="card" style={{ padding: 24 }}>
        {activeStep === 'dq' && <StepDQ key={activeNovelKey} novel={novel} />}
        {activeStep === 'composition' && <StepComposition key={activeNovelKey} novel={novel} />}
        {activeStep === 'char-info' && <StepCharInfo key={activeNovelKey} novel={novel} />}
        {activeStep === 'char-prompt' && <StepCharPrompt key={activeNovelKey} novel={novel} />}
        {activeStep === 'scene' && <StepScene key={activeNovelKey} novel={novel} />}
      </div>
    </div>
  );
}
