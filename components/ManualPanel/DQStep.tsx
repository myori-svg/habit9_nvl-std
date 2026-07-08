'use client';
import { Check, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { buildDQPrompt, DEFAULT_PROMPT_TEMPLATES } from '@/lib/prompts';
import { useStore } from '@/lib/store';
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
  const { promptTemplates, addChapterParts, setPartDQs } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dqResult, setDqResult] = useState('');
  const [saved, setSaved] = useState(false);

  const selectedParts = novel.parts.filter((p) => dqChapters.includes(p.id));
  const selectedSummary =
    novel.parts.length > 0
      ? selectedParts.map((p) => `${p.label}\n${p.content}`).join('\n\n')
      : dqCustomSummary;
  const dqPrompt = buildDQPrompt(
    novel.title,
    selectedSummary,
    promptTemplates.dq ?? DEFAULT_PROMPT_TEMPLATES.dq
  );

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/parse-summary', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const chapters: { label: string; content: string }[] = data.chapters;
      if (chapters.length > 0) {
        await addChapterParts(novel.id, chapters);
      } else {
        setDqCustomSummary(data.text);
      }
    } catch (e) {
      setUploadError(String(e));
    } finally {
      setUploading(false);
    }
  };

  const handleSaveDQs = async () => {
    if (!dqResult.trim() || selectedParts.length === 0) return;
    const questions = dqResult
      .trim()
      .split(/\n*===\n*/)
      .map((q) => q.trim())
      .filter(Boolean)
      .map((text) => ({ text }));

    for (const part of selectedParts) {
      await setPartDQs(novel.id, part.id, questions);
    }
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setDqResult('');
    }, 1500);
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <input
          ref={fileRef}
          type="file"
          accept=".docx,.txt"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
        <button
          type="button"
          className="btn-ghost"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            padding: '7px 14px',
          }}
        >
          <Upload size={12} />
          {uploading ? '파싱 중…' : '서머리 파일 업로드 (.docx / .txt)'}
        </button>
        {uploadError && (
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
            {uploadError}
          </div>
        )}
      </div>

      {novel.parts.length > 0 ? (
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
            {novel.parts.map((p) => {
              const sel = dqChapters.includes(p.id);
              return (
                // biome-ignore lint/a11y/noStaticElementInteractions: internal tool
                // biome-ignore lint/a11y/useKeyWithClickEvents: internal tool
                <div
                  key={p.id}
                  onClick={() =>
                    setDqChapters((prev) =>
                      sel ? prev.filter((x) => x !== p.id) : [...prev, p.id]
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
                  {p.label}
                  {p.discussionQuestions.length > 0 && (
                    <span style={{ fontSize: 10, color: 'var(--sage)' }}>
                      DQ {p.discussionQuestions.length}개
                    </span>
                  )}
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
            챕터가 아직 없어요. 파일을 업로드하거나 직접 입력하세요:
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
      <PromptBox
        prompt={dqPrompt}
        label="Gemini에 붙여넣을 프롬프트"
        templateKey="dq"
        vars={{ novelTitle: novel.title, selectedSummary }}
      />

      {selectedParts.length > 0 && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            background: 'var(--parchment)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--ink-soft)',
              marginBottom: 10,
            }}
          >
            DQ 결과 저장
          </div>
          <p
            style={{
              fontSize: 11,
              color: 'var(--ink-soft)',
              margin: '0 0 10px',
              lineHeight: 1.6,
            }}
          >
            Gemini 결과를 붙여넣으면 선택한 챕터에 저장됩니다. 질문 간 구분자는{' '}
            <code>===</code>, 질문 내 파트 구분자는 <code>---</code>입니다.
          </p>
          <textarea
            className="input-field"
            value={dqResult}
            onChange={(e) => setDqResult(e.target.value)}
            placeholder="Gemini 결과 붙여넣기"
            style={{ fontSize: 12, minHeight: 100, marginBottom: 10 }}
          />
          <button
            type="button"
            className="btn-primary"
            onClick={handleSaveDQs}
            disabled={!dqResult.trim() || saved}
            style={{
              fontSize: 12,
              padding: '7px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {saved ? (
              <>
                <Check size={12} /> Saved!
              </>
            ) : (
              '저장'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
