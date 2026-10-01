'use client';
import { FileText, ImageIcon, X } from 'lucide-react';
import { useState } from 'react';
import { TemplateEditor } from '@/components/ManualPanel/shared';
import {
  grammarFilePath,
  MAX_IMAGE_BYTES,
  uploadGrammarFile,
} from '@/lib/blob-upload';
import {
  GRAMMAR_MAX_IMAGES,
  GRAMMAR_MAX_TOTAL,
  parseCountInput,
  resolveQuestionCounts,
} from '@/lib/grammar-job';
import { shrinkImage } from '@/lib/image-shrink';
import { useStore } from '@/lib/store';
import type { GrammarInputFile } from '@/types';

const PDF_MIME = 'application/pdf';
const PDF_MAX_MB = MAX_IMAGE_BYTES / 1024 / 1024;

const sectionLabelStyle = {
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-soft)',
  marginBottom: 8,
};

const countInputStyle = {
  fontSize: 13,
  width: 90,
  textAlign: 'center' as const,
};

function isPdf(file: File): boolean {
  return file.type === PDF_MIME || file.name.toLowerCase().endsWith('.pdf');
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)}MB`
    : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

// 선택한 파일에 새로 고른 파일을 더한 목록을 돌려준다. 사진은 15장까지 이어서 더하고,
// PDF는 1개만 받으며 사진과 섞을 수 없다.
function mergeSelectedFiles(
  current: File[],
  incoming: File[]
): { files: File[]; error?: string } {
  if (incoming.some((f) => !f.type.startsWith('image/') && !isPdf(f))) {
    return { files: current, error: '사진이나 PDF만 올릴 수 있어요' };
  }
  const incomingPdfs = incoming.filter(isPdf);
  if (incomingPdfs.length > 0) {
    if (
      incomingPdfs.length > 1 ||
      incoming.length > 1 ||
      current.some((f) => !isPdf(f))
    ) {
      return {
        files: current,
        error: 'PDF는 1개만 올릴 수 있고, 사진과 함께 올릴 수 없어요',
      };
    }
    if (incomingPdfs[0].size > MAX_IMAGE_BYTES) {
      return {
        files: current,
        error: `PDF는 ${PDF_MAX_MB}MB 이하만 올릴 수 있어요`,
      };
    }
    return { files: incomingPdfs };
  }
  if (current.some(isPdf)) {
    return {
      files: current,
      error: 'PDF를 올린 상태에서는 사진을 더할 수 없어요. PDF를 먼저 빼주세요',
    };
  }
  const merged = [...current, ...incoming];
  if (merged.length > GRAMMAR_MAX_IMAGES) {
    return {
      files: current,
      error: `사진은 최대 ${GRAMMAR_MAX_IMAGES}장까지 올릴 수 있어요`,
    };
  }
  return { files: merged };
}

export default function GrammarForm({
  onCreated,
}: {
  onCreated: (jobId: string) => void;
}) {
  const { promptTemplates } = useStore();
  // 같은 파일을 다시 골라도 목록 키가 겹치지 않도록 선택마다 ID를 붙인다.
  const [entries, setEntries] = useState<{ id: string; file: File }[]>([]);
  const files = entries.map((entry) => entry.file);
  const [totalText, setTotalText] = useState('');
  const [multipleChoiceText, setMultipleChoiceText] = useState('');
  const [shortAnswerText, setShortAnswerText] = useState('');
  const [extraRequest, setExtraRequest] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const total = parseCountInput(totalText);
  const multipleChoice = parseCountInput(multipleChoiceText);
  const shortAnswer = parseCountInput(shortAnswerText);
  const usingSplit = multipleChoice !== null || shortAnswer !== null;
  const countsMalformed = [total, multipleChoice, shortAnswer].some(
    (n) => n !== null && Number.isNaN(n)
  );
  const counts = resolveQuestionCounts({
    total: total === null || Number.isNaN(total) ? null : total,
    multipleChoice:
      multipleChoice === null || Number.isNaN(multipleChoice)
        ? null
        : multipleChoice,
    shortAnswer:
      shortAnswer === null || Number.isNaN(shortAnswer) ? null : shortAnswer,
  });
  const countProblem = countsMalformed
    ? '문제 수는 0 이상의 숫자로 입력해주세요'
    : counts.total < 1
      ? '문제를 1개 이상 만들어야 해요'
      : counts.total > GRAMMAR_MAX_TOTAL
        ? `문제는 최대 ${GRAMMAR_MAX_TOTAL}개까지 만들 수 있어요`
        : '';
  const canSubmit = files.length > 0 && !countProblem && !busy;

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (picked.length === 0) return;
    const merged = mergeSelectedFiles(files, picked);
    setEntries((prev) =>
      merged.files.map(
        (file) =>
          prev.find((entry) => entry.file === file) ?? {
            id: crypto.randomUUID(),
            file,
          }
      )
    );
    setError(merged.error ?? '');
  };

  const handleSubmit = async () => {
    setError('');
    const jobId = crypto.randomUUID();
    try {
      setBusy('사진을 줄이고 올리는 중…');
      const uploaded: GrammarInputFile[] = await Promise.all(
        files.map(async (file, index) => {
          const pdf = isPdf(file);
          const mime = pdf ? PDF_MIME : 'image/jpeg';
          const body = pdf ? file : await shrinkImage(file);
          const path = await uploadGrammarFile(
            grammarFilePath(jobId, index, mime),
            body,
            mime
          );
          return { path, name: file.name, mime };
        })
      );

      setBusy('생성 요청 중…');
      const res = await fetch('/api/grammar-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          jobId,
          files: uploaded,
          multipleChoiceCount: counts.multipleChoice,
          shortAnswerCount: counts.shortAnswer,
          extraRequest,
          grammarTemplate: promptTemplates.grammar,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `요청이 실패했어요 (${res.status})`);
      }
      setEntries([]);
      setExtraRequest('');
      onCreated(jobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  };

  return (
    <div
      style={{
        background: 'var(--parchment)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      <div>
        <div style={sectionLabelStyle}>
          교재 자료 (사진 {GRAMMAR_MAX_IMAGES}장 이하 또는 PDF 1개)
        </div>
        <label
          className="btn-ghost"
          style={{ display: 'inline-block', cursor: 'pointer' }}
        >
          사진·PDF 선택
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            onChange={handlePick}
            disabled={busy !== ''}
            style={{ display: 'none' }}
          />
        </label>
        {files.length > 0 && (
          <div
            style={{
              marginTop: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {entries.map(({ id, file }) => (
              <div
                key={id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  padding: '5px 8px',
                  background: 'white',
                }}
              >
                {isPdf(file) ? <FileText size={13} /> : <ImageIcon size={13} />}
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {file.name}
                </span>
                <span style={{ color: 'var(--ink-soft)', flexShrink: 0 }}>
                  {formatSize(file.size)}
                </span>
                <button
                  type="button"
                  aria-label={`${file.name} 빼기`}
                  disabled={busy !== ''}
                  onClick={() =>
                    setEntries((prev) => prev.filter((e) => e.id !== id))
                  }
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--ink-soft)',
                    padding: 2,
                  }}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div style={sectionLabelStyle}>문제 수</div>
        <div
          style={{
            display: 'flex',
            gap: 14,
            flexWrap: 'wrap',
            alignItems: 'flex-end',
          }}
        >
          <CountField label="전체">
            <input
              className="input-field"
              inputMode="numeric"
              value={usingSplit ? String(counts.total) : totalText}
              onChange={(e) => setTotalText(e.target.value)}
              aria-label="전체 문제 수"
              placeholder="15"
              disabled={usingSplit || busy !== ''}
              style={countInputStyle}
            />
          </CountField>
          <CountField label="객관식">
            <input
              className="input-field"
              inputMode="numeric"
              value={multipleChoiceText}
              onChange={(e) => setMultipleChoiceText(e.target.value)}
              aria-label="객관식 문제 수"
              placeholder={usingSplit ? '0' : String(counts.multipleChoice)}
              disabled={busy !== ''}
              style={countInputStyle}
            />
          </CountField>
          <CountField label="서술형">
            <input
              className="input-field"
              inputMode="numeric"
              value={shortAnswerText}
              onChange={(e) => setShortAnswerText(e.target.value)}
              aria-label="서술형 문제 수"
              placeholder={usingSplit ? '0' : String(counts.shortAnswer)}
              disabled={busy !== ''}
              style={countInputStyle}
            />
          </CountField>
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            lineHeight: 1.6,
            color: countProblem ? 'var(--crimson)' : 'var(--ink-soft)',
          }}
        >
          {countProblem ||
            `객관식 ${counts.multipleChoice}개 + 서술형 ${counts.shortAnswer}개 = ${counts.total}문제. ${
              usingSplit
                ? '객관식·서술형을 입력하면 그 합계가 전체 문제 수가 돼요.'
                : '전체만 입력하면 객관식 : 서술형을 2 : 1로 나눠요.'
            }`}
        </div>
      </div>

      <div>
        <div style={sectionLabelStyle}>추가 요청 (선택)</div>
        <textarea
          className="input-field"
          value={extraRequest}
          onChange={(e) => setExtraRequest(e.target.value)}
          disabled={busy !== ''}
          placeholder={'예: Unit 5, 현재완료\n시제 구분 위주로 내줘'}
          style={{ fontSize: 13, minHeight: 70 }}
        />
      </div>

      {error && (
        <div
          style={{
            padding: '10px 14px',
            background: '#fff5f5',
            fontSize: 12,
            lineHeight: 1.6,
            color: 'var(--crimson)',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          className="btn-primary"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          생성
        </button>
        {busy && (
          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{busy}</span>
        )}
      </div>

      <div>
        <div style={sectionLabelStyle}>프롬프트</div>
        <TemplateEditor templateKey="grammar" />
      </div>
    </div>
  );
}

function CountField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        fontSize: 12,
        color: 'var(--ink-soft)',
      }}
    >
      <span>{label}</span>
      {children}
    </div>
  );
}
