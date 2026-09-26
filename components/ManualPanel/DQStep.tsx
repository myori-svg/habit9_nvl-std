'use client';
import { Check, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { splitQuestionBlocks } from '@/lib/output-format';
import {
  buildDQPrompt,
  DQ_OUTPUT_FORMAT_INSTRUCTION,
  resolvePromptTemplate,
} from '@/lib/prompts';
import { useStore } from '@/lib/store';
import type { Novel, NovelPart } from '@/types';
import { PromptBox, TemplateFallbackNotice } from './shared';

interface Props {
  novel: Novel;
  dqChapters: string[];
  setDqChapters: React.Dispatch<React.SetStateAction<string[]>>;
  dqCustomSummary: string;
  setDqCustomSummary: React.Dispatch<React.SetStateAction<string>>;
}

interface ChapterFileGroup {
  key: string;
  name: string;
  parts: NovelPart[];
}

const LEGACY_FILE_GROUP_KEY = 'legacy';

// 업로드 파일 단위로 챕터를 묶는다. 파일 정보가 기록되기 전에 올라간 챕터는
// 어느 파일에서 왔는지 알 수 없으므로 하나의 "이전 업로드" 묶음으로 모은다.
function groupPartsBySourceFile(parts: NovelPart[]): ChapterFileGroup[] {
  const groups = new Map<string, ChapterFileGroup>();
  for (const part of parts) {
    const key = part.sourceFileId ?? LEGACY_FILE_GROUP_KEY;
    const group = groups.get(key) ?? {
      key,
      name: part.sourceFileName ?? '이전에 업로드한 챕터',
      parts: [],
    };
    group.parts.push(part);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export default function DQStep({
  novel,
  dqChapters,
  setDqChapters,
  dqCustomSummary,
  setDqCustomSummary,
}: Props) {
  const { promptTemplates, addChapterParts, deleteParts, setPartDQs } =
    useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dqResult, setDqResult] = useState('');
  const [saved, setSaved] = useState(false);

  const fileGroups = groupPartsBySourceFile(novel.parts);
  const selectedParts = novel.parts.filter((p) => dqChapters.includes(p.id));
  const selectedSummary =
    novel.parts.length > 0
      ? selectedParts.map((p) => `${p.label}\n${p.content}`).join('\n\n')
      : dqCustomSummary;
  const dqTemplate = resolvePromptTemplate('dq', promptTemplates.dq);
  const dqPrompt = buildDQPrompt(
    novel.title,
    selectedSummary,
    dqTemplate.template
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
        await addChapterParts(novel.id, chapters, file.name);
      } else {
        setDqCustomSummary(data.text);
      }
    } catch (e) {
      setUploadError(String(e));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (group: ChapterFileGroup) => {
    const dqCount = group.parts.reduce(
      (sum, p) => sum + p.discussionQuestions.length,
      0
    );
    const dqWarning =
      dqCount > 0 ? ` 저장된 DQ ${dqCount}개도 함께 삭제됩니다.` : '';
    if (
      !window.confirm(
        `"${group.name}"에서 나온 챕터 ${group.parts.length}개를 삭제할까요?${dqWarning}`
      )
    )
      return;
    const deletedIds = group.parts.map((p) => p.id);
    await deleteParts(novel.id, deletedIds);
    setDqChapters((prev) => prev.filter((id) => !deletedIds.includes(id)));
  };

  const handleSaveDQs = async () => {
    if (!dqResult.trim() || selectedParts.length === 0) return;
    const questions = splitQuestionBlocks(dqResult).map((text) => ({ text }));

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
              업로드한 파일
            </div>
            {fileGroups.map((group) => (
              <div
                key={group.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '6px 10px',
                  marginBottom: 4,
                  background: 'var(--parchment)',
                  fontSize: 12,
                }}
              >
                <span>
                  {group.name}{' '}
                  <span style={{ color: 'var(--ink-soft)' }}>
                    · 챕터 {group.parts.length}개
                  </span>
                </span>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => handleDeleteFile(group)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                    padding: '3px 8px',
                    color: 'var(--crimson)',
                  }}
                >
                  <Trash2 size={11} /> 삭제
                </button>
              </div>
            ))}
          </div>
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
      <TemplateFallbackNotice templateName="DQ" missing={dqTemplate.missing} />
      <PromptBox
        prompt={dqPrompt}
        label="Gemini에 붙여넣을 프롬프트"
        templateKey="dq"
        appendix={DQ_OUTPUT_FORMAT_INSTRUCTION}
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
