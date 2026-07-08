'use client';
import {
  Check,
  Download,
  Image,
  RefreshCw,
  Sparkles,
  User,
} from 'lucide-react';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import type { Character, Novel } from '@/types';

interface Props {
  novel: Novel;
}

export default function WorkPanel({ novel }: Props) {
  const { updateDQ, addHistory, promptTemplates, setPartDQs } = useStore();
  const [selectedPartId, setSelectedPartId] = useState<string>(
    novel.parts[0]?.id ?? ''
  );
  const [selectedDQId, setSelectedDQId] = useState<string>('');
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generatingDQ, setGeneratingDQ] = useState(false);
  const [error, setError] = useState('');
  const [dqError, setDqError] = useState('');

  const selectedPart = novel.parts.find((p) => p.id === selectedPartId);
  const selectedDQ = selectedPart?.discussionQuestions.find(
    (dq) => dq.id === selectedDQId
  );

  const generateDQ = async () => {
    if (!selectedPart) return;
    setGeneratingDQ(true);
    setDqError('');

    try {
      const res = await fetch('/api/generate-dq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          novelTitle: novel.title,
          partContent: selectedPart.content,
          characterNames: novel.characters.map((c) => c.name),
          dqTemplate: promptTemplates.dq,
          compositionTemplate: promptTemplates.composition,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      await setPartDQs(novel.id, selectedPart.id, data.discussionQuestions);
    } catch (e) {
      setDqError(String(e));
    } finally {
      setGeneratingDQ(false);
    }
  };

  const toggleChar = (id: string) => {
    setSelectedCharIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const generateScene = async () => {
    if (!selectedDQ) return;
    setGenerating(true);
    setError('');

    try {
      const selectedChars = novel.characters.filter((c) =>
        selectedCharIds.includes(c.id)
      );
      const res = await fetch('/api/generate-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          styleRefImages: novel.styleRefImages,
          stylePrompt: novel.stylePrompt,
          compositionPrompt: selectedDQ.compositionPrompt,
          characters: selectedChars.map((c) => ({
            name: c.name,
            textPrompt: c.textPrompt,
            imageBase64: c.imageBase64,
            imageMime: c.imageMime,
          })),
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      updateDQ(novel.id, selectedPartId, selectedDQId, {
        sceneImage: data.imageBase64,
        sceneMime: data.imageMime,
      });

      addHistory({
        novelId: novel.id,
        novelTitle: novel.title,
        type: 'scene',
        label: `${selectedPart?.label} — ${selectedDQ.text.slice(0, 60)}`,
        imageBase64: data.imageBase64,
        imageMime: data.imageMime,
        prompt: selectedDQ.compositionPrompt,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  };

  const downloadImage = (base64: string, mime: string, name: string) => {
    const ext = mime.split('/')[1] || 'png';
    const a = document.createElement('a');
    a.href = `data:${mime};base64,${base64}`;
    a.download = `${name}.${ext}`;
    a.click();
  };

  return (
    <div
      style={{
        maxWidth: 1000,
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: '300px 1fr',
        gap: 24,
      }}
    >
      {/* Left: selector panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Part selector */}
        <div className="card" style={{ padding: 16 }}>
          <span
            style={{
              fontSize: 10,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--ink-soft)',
              display: 'block',
              marginBottom: 10,
            }}
          >
            Chapter / Part
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {novel.parts.map((part) => (
              <button
                type="button"
                key={part.id}
                onClick={() => {
                  setSelectedPartId(part.id);
                  setSelectedDQId('');
                }}
                style={{
                  background:
                    selectedPartId === part.id ? 'var(--ink)' : 'transparent',
                  color:
                    selectedPartId === part.id
                      ? 'var(--parchment)'
                      : 'var(--ink)',
                  border: '1px solid',
                  borderColor:
                    selectedPartId === part.id ? 'var(--ink)' : 'var(--border)',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 13,
                  transition: 'all 0.15s',
                }}
              >
                {part.label}
              </button>
            ))}
          </div>
        </div>

        {/* DQ selector */}
        {selectedPart && (
          <div className="card" style={{ padding: 16 }}>
            <span
              style={{
                fontSize: 10,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--ink-soft)',
                display: 'block',
                marginBottom: 10,
              }}
            >
              Discussion Question
            </span>

            {selectedPart.content && (
              <button
                type="button"
                className="btn-gold"
                onClick={generateDQ}
                disabled={generatingDQ}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontSize: 12,
                  padding: '8px 12px',
                  marginBottom: 10,
                }}
              >
                {generatingDQ ? (
                  <>
                    <RefreshCw
                      size={12}
                      style={{ animation: 'spin 1s linear infinite' }}
                    />
                    생성 중…
                  </>
                ) : (
                  <>
                    <Sparkles size={12} />
                    {selectedPart.discussionQuestions.length > 0
                      ? 'DQ+구도 다시 생성'
                      : 'DQ+구도 자동 생성'}
                  </>
                )}
              </button>
            )}
            {dqError && (
              <div
                style={{
                  marginBottom: 10,
                  padding: '8px 12px',
                  background: '#fff5f5',
                  border: '1px solid #fcc',
                  fontSize: 11,
                  color: 'var(--crimson)',
                }}
              >
                {dqError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selectedPart.discussionQuestions.map((dq, i) => (
                <button
                  type="button"
                  key={dq.id}
                  onClick={() => setSelectedDQId(dq.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor:
                      selectedDQId === dq.id ? 'var(--gold)' : 'var(--border)',
                    background:
                      selectedDQId === dq.id
                        ? 'rgba(201,168,76,0.08)'
                        : 'white',
                    transition: 'all 0.15s',
                    position: 'relative',
                  }}
                >
                  {dq.sceneImage && (
                    <div style={{ position: 'absolute', top: 6, right: 6 }}>
                      <Image size={10} style={{ color: 'var(--sage)' }} />
                    </div>
                  )}
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--gold)',
                      fontWeight: 600,
                      marginRight: 6,
                    }}
                  >
                    Q{i + 1}
                  </span>
                  <span style={{ fontSize: 12, lineHeight: 1.4 }}>
                    {dq.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Character selector */}
        {novel.characters.length > 0 && selectedDQ && (
          <div className="card" style={{ padding: 16 }}>
            <span
              style={{
                fontSize: 10,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--ink-soft)',
                display: 'block',
                marginBottom: 10,
              }}
            >
              Characters in Scene
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {novel.characters.map((char) => (
                <CharacterRow
                  key={char.id}
                  char={char}
                  selected={selectedCharIds.includes(char.id)}
                  onToggle={() => toggleChar(char.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right: scene area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!selectedDQ ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: 300,
              opacity: 0.4,
            }}
          >
            <p className="serif" style={{ fontSize: 16, fontWeight: 300 }}>
              Select a discussion question to begin
            </p>
          </div>
        ) : (
          <>
            {/* Composition prompt preview */}
            <div className="card" style={{ padding: 20 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-soft)',
                  }}
                >
                  Scene Composition Prompt
                </span>
              </div>
              <p
                style={{
                  fontSize: 12,
                  lineHeight: 1.7,
                  color: 'var(--ink-soft)',
                  margin: 0,
                  fontStyle: 'italic',
                }}
              >
                {selectedDQ.compositionPrompt}
              </p>
            </div>

            {error && (
              <div
                style={{
                  background: '#fff5f5',
                  border: '1px solid #fcc',
                  padding: '10px 14px',
                  fontSize: 13,
                  color: 'var(--crimson)',
                }}
              >
                {error}
              </div>
            )}

            {/* Generate button */}
            <button
              type="button"
              className="btn-gold"
              onClick={generateScene}
              disabled={generating}
              style={{
                alignSelf: 'flex-start',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '11px 22px',
              }}
            >
              {generating ? (
                <>
                  <RefreshCw
                    size={14}
                    style={{ animation: 'spin 1s linear infinite' }}
                  />{' '}
                  Generating…
                </>
              ) : (
                <>
                  <Image size={14} />{' '}
                  {selectedDQ.sceneImage
                    ? 'Regenerate Scene'
                    : 'Generate Scene'}
                </>
              )}
            </button>

            {/* Loading placeholder */}
            {generating && (
              <div
                className="loading-shimmer"
                style={{ width: '100%', aspectRatio: '16/9' }}
              />
            )}

            {/* Generated image */}
            {selectedDQ.sceneImage && !generating && (
              <div className="card fade-up" style={{ overflow: 'hidden' }}>
                {/* biome-ignore lint/performance/noImgElement: dynamic base64 data URI, not eligible for next/image optimization */}
                <img
                  src={`data:${selectedDQ.sceneMime || 'image/png'};base64,${selectedDQ.sceneImage}`}
                  alt="Generated scene"
                  style={{ width: '100%', display: 'block' }}
                />
                <div
                  style={{
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      if (!selectedDQ.sceneImage) return;
                      downloadImage(
                        selectedDQ.sceneImage,
                        selectedDQ.sceneMime || 'image/png',
                        `scene-${selectedPart?.label}`
                      );
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                    }}
                  >
                    <Download size={12} /> Download
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function CharacterRow({
  char,
  selected,
  onToggle,
}: {
  char: Character;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        cursor: 'pointer',
        border: '1px solid',
        borderColor: selected ? 'var(--gold)' : 'var(--border)',
        background: selected ? 'rgba(201,168,76,0.08)' : 'white',
        transition: 'all 0.15s',
      }}
    >
      {char.imageBase64 ? (
        // biome-ignore lint/performance/noImgElement: dynamic base64 data URI, not eligible for next/image optimization
        <img
          src={`data:${char.imageMime || 'image/png'};base64,${char.imageBase64}`}
          alt={char.name}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            objectFit: 'cover',
            border: '1px solid var(--border)',
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--parchment)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <User size={14} style={{ color: 'var(--ink-soft)' }} />
        </div>
      )}
      <span style={{ fontSize: 13, flex: 1 }}>{char.name}</span>
      {selected && (
        <Check size={12} style={{ color: 'var(--gold)', flexShrink: 0 }} />
      )}
    </button>
  );
}
