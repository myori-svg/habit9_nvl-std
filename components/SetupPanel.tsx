'use client';
import { AlertCircle, CheckCircle, Loader, Play, Upload } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import type { Novel } from '@/types';

interface Props {
  novel: Novel;
}

interface ProgressEvent {
  step: string;
  message: string;
  current?: number;
  total?: number;
  result?: { parts: Novel['parts']; characters: Novel['characters'] };
}

const STEP_ORDER = [
  'generating-dq',
  'generating-composition',
  'extracting-characters',
  'generating-char-info',
  'generating-char-prompts',
  'generating-char-images',
  'done',
];

const STEP_LABELS: Record<string, string> = {
  'generating-dq': 'Discussion Questions',
  'generating-composition': 'Scene Compositions',
  'extracting-characters': 'Character Extraction',
  'generating-char-info': 'Character Info',
  'generating-char-prompts': 'Character Prompts',
  'generating-char-images': 'Character Images',
  done: 'Complete',
};

export default function SetupPanel({ novel }: Props) {
  const { updateNovel, addStyleRefImage } = useStore();
  const [summary, setSummary] = useState(novel.summary || '');
  const [stylePrompt, setStylePrompt] = useState(novel.stylePrompt || '');
  const [styleImageBase64, setStyleImageBase64] = useState<string>('');
  const [styleImageMime, setStyleImageMime] = useState<string>('');
  const [stylePreview, setStylePreview] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [error, setError] = useState('');

  const handleStyleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [header, data] = result.split(',');
      const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
      setStyleImageBase64(data);
      setStyleImageMime(mime);
      setStylePreview(result);
    };
    reader.readAsDataURL(file);
  };

  const handleRun = async () => {
    if (!summary.trim()) return;

    setRunning(true);
    setError('');
    setProgress({ step: 'generating-dq', message: 'Starting…' });

    // Save summary to novel
    updateNovel(novel.id, { summary, stylePrompt });
    if (styleImageBase64 && styleImageMime) {
      addStyleRefImage(novel.id, styleImageBase64, styleImageMime);
    }

    try {
      const res = await fetch('/api/setup-novel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: novel.title,
          summary,
          stylePrompt,
          styleRefImages:
            styleImageBase64 && styleImageMime
              ? [{ base64: styleImageBase64, mime: styleImageMime }]
              : [],
        }),
      });

      if (!res.body) throw new Error('No response stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data: ProgressEvent = JSON.parse(line.slice(6));
          setProgress(data);

          if (data.step === 'done' && data.result) {
            updateNovel(novel.id, {
              parts: data.result.parts,
              characters: data.result.characters,
            });
          }
          if (data.step === 'error') {
            setError(data.message);
            setRunning(false);
            return;
          }
        }
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  };

  const currentStepIdx = progress ? STEP_ORDER.indexOf(progress.step) : -1;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h2
          className="serif"
          style={{ fontSize: 28, fontWeight: 300, margin: '0 0 6px' }}
        >
          Setup: {novel.title}
        </h2>
        <p
          style={{
            fontSize: 13,
            color: 'var(--ink-soft)',
            margin: 0,
            opacity: 0.7,
          }}
        >
          Paste the full chapter summary and a style reference image. The AI
          will automatically generate everything needed.
        </p>
      </div>

      {!running && progress?.step !== 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Summary input */}
          <div className="card" style={{ padding: 24 }}>
            <label
              htmlFor="novel-summary"
              style={{
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--ink-soft)',
                display: 'block',
                marginBottom: 10,
              }}
            >
              Full Novel Summary *
            </label>
            <textarea
              id="novel-summary"
              className="input-field"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={`Paste the full chapter-by-chapter summary here.\n\nExample:\nChapter 1-2\nClaudia Kincaid decides to run away from home because...\n\nChapter 3-4\n...`}
              style={{ minHeight: 200, fontSize: 13, lineHeight: 1.7 }}
            />
          </div>

          {/* Style image upload */}
          <div className="card" style={{ padding: 24 }}>
            <label
              htmlFor="style-image-input"
              style={{
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--ink-soft)',
                display: 'block',
                marginBottom: 10,
              }}
            >
              Style Reference Image (화풍 참고)
            </label>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <label
                htmlFor="style-image-input"
                style={{
                  width: 120,
                  height: 120,
                  border: '2px dashed var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'border-color 0.2s',
                  background: stylePreview ? 'none' : 'var(--cream)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = 'var(--gold)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = 'var(--border)')
                }
              >
                {stylePreview ? (
                  // biome-ignore lint/performance/noImgElement: dynamic data URI preview, not eligible for next/image optimization
                  <img
                    src={stylePreview}
                    alt="style ref"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <>
                    <Upload
                      size={20}
                      style={{ color: 'var(--gold-dim)', marginBottom: 6 }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--ink-soft)',
                        textAlign: 'center',
                      }}
                    >
                      Click to upload
                    </span>
                  </>
                )}
              </label>
              <input
                id="style-image-input"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleStyleImage}
              />

              <div style={{ flex: 1 }}>
                <p
                  style={{
                    fontSize: 12,
                    color: 'var(--ink-soft)',
                    margin: '0 0 10px',
                    lineHeight: 1.5,
                  }}
                >
                  Upload any illustration that represents the art style you
                  want. This will be referenced for all character and scene
                  images.
                </p>
                <label
                  htmlFor="style-prompt"
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-soft)',
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  Style Prompt (optional, supplements the image)
                </label>
                <textarea
                  id="style-prompt"
                  className="input-field"
                  value={stylePrompt}
                  onChange={(e) => setStylePrompt(e.target.value)}
                  placeholder="e.g. cozy heartwarming watercolor and colored pencil storybook illustration, soft hand-drawn outlines, warm golden light, muted pastels…"
                  style={{ minHeight: 70, fontSize: 12 }}
                />
              </div>
            </div>
          </div>

          {error && (
            <div
              style={{
                background: '#fff5f5',
                border: '1px solid #fcc',
                padding: '10px 14px',
                fontSize: 13,
                color: 'var(--crimson)',
                display: 'flex',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <button
            type="button"
            className="btn-gold"
            onClick={handleRun}
            disabled={!summary.trim()}
            style={{
              alignSelf: 'flex-end',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 24px',
              fontSize: 13,
            }}
          >
            <Play size={14} /> Run Full Setup Pipeline
          </button>
        </div>
      )}

      {/* Progress display */}
      {(running || progress?.step === 'done') && (
        <div className="card fade-up" style={{ padding: 28 }}>
          <h3
            className="serif"
            style={{ fontSize: 18, fontWeight: 400, margin: '0 0 20px' }}
          >
            {progress?.step === 'done'
              ? '✅ Setup Complete!'
              : '⚙️ Running Setup Pipeline…'}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {STEP_ORDER.filter((s) => s !== 'done').map((step, idx) => {
              const isDone = currentStepIdx > idx;
              const isActive = currentStepIdx === idx;
              return (
                <div
                  key={step}
                  style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isDone
                        ? 'var(--sage)'
                        : isActive
                          ? 'var(--gold)'
                          : 'var(--border)',
                      transition: 'background 0.3s',
                    }}
                  >
                    {isDone ? (
                      <CheckCircle size={14} color="white" />
                    ) : isActive ? (
                      <Loader
                        size={14}
                        color="var(--ink)"
                        style={{ animation: 'spin 1s linear infinite' }}
                      />
                    ) : (
                      <span
                        style={{
                          fontSize: 11,
                          color: isActive ? 'var(--ink)' : 'var(--ink-soft)',
                        }}
                      >
                        {idx + 1}
                      </span>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: isActive ? 500 : 400,
                        color: isDone
                          ? 'var(--sage)'
                          : isActive
                            ? 'var(--ink)'
                            : 'var(--ink-soft)',
                        opacity: isDone || isActive ? 1 : 0.4,
                      }}
                    >
                      {STEP_LABELS[step]}
                    </span>
                    {isActive && progress && (
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--ink-soft)',
                          marginTop: 2,
                        }}
                      >
                        {progress.message}
                        {progress.total &&
                          ` (${progress.current}/${progress.total})`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  );
}
