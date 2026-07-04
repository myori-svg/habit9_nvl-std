'use client';
import { Check, Sparkles, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { downloadBase64File } from '@/lib/download';
import {
  buildCharImagePrompt,
  DEFAULT_PROMPT_TEMPLATES,
  getStyleRef,
} from '@/lib/prompts';
import { useStore } from '@/lib/store';
import type { Character, Novel } from '@/types';
import { type AutoGenCharStatus, AutoGenStatusList, PromptBox } from './shared';

interface Props {
  novel: Novel;
  charImageName: string;
  setCharImageName: React.Dispatch<React.SetStateAction<string>>;
  imageFile: File | null;
  setImageFile: React.Dispatch<React.SetStateAction<File | null>>;
  imagePreview: string;
  setImagePreview: React.Dispatch<React.SetStateAction<string>>;
  uploading: boolean;
  setUploading: React.Dispatch<React.SetStateAction<boolean>>;
  uploadDone: boolean;
  setUploadDone: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function CharImageStep({
  novel,
  charImageName,
  setCharImageName,
  imageFile,
  setImageFile,
  imagePreview,
  setImagePreview,
  uploading,
  setUploading,
  uploadDone,
  setUploadDone,
}: Props) {
  const {
    saveCharImage,
    updateCharacter,
    updateNovel,
    addStyleRefImage,
    removeStyleRefImage,
    promptTemplates,
  } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const refImageRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState('');
  const [stylePromptInput, setStylePromptInput] = useState(
    novel.stylePrompt || ''
  );

  const [autoRunning, setAutoRunning] = useState(false);
  const [charStatus, setCharStatus] = useState<
    Record<string, AutoGenCharStatus>
  >({});

  const pendingChars = novel.characters.filter((c) => !c.imageGenerated);

  const handleRefImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [header, base64] = result.split(',');
      const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
      addStyleRefImage(novel.id, base64, mime);
    };
    reader.readAsDataURL(file);
  };

  const generateImageForChar = async (char: Character, label: string) => {
    setCharStatus((prev) => ({
      ...prev,
      [char.id]: { state: 'running', message: `${char.name} ${label}` },
    }));
    try {
      const res = await fetch('/api/generate-character-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          styleRefImages: novel.styleRefImages,
          stylePrompt: novel.stylePrompt,
          textPrompt: char.textPrompt,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      downloadBase64File(data.imageBase64, data.imageMime, char.name);
      await updateCharacter(novel.id, char.id, {
        imageBase64: data.imageBase64,
        imageMime: data.imageMime,
        imageGenerated: true,
      });
      setCharStatus((prev) => ({
        ...prev,
        [char.id]: { state: 'done', message: '생성 완료!' },
      }));
    } catch (e) {
      setCharStatus((prev) => ({
        ...prev,
        [char.id]: { state: 'error', message: String(e) },
      }));
    }
  };

  const handleAutoGenerate = async () => {
    setAutoRunning(true);
    setCharStatus(
      Object.fromEntries(pendingChars.map((c) => [c.id, { state: 'pending' }]))
    );
    for (const char of pendingChars) {
      await generateImageForChar(char, '생성 중…');
    }
    setAutoRunning(false);
  };

  const handleRegenerate = (charId: string) => {
    const char = novel.characters.find((c) => c.id === charId);
    if (char) generateImageForChar(char, '재생성 중…');
  };

  const style = getStyleRef(novel.stylePrompt);
  const charImageTextPrompt =
    novel.characters.find((c) => c.name === charImageName)?.textPrompt ?? '';
  const charImagePrompt = buildCharImagePrompt(
    style,
    charImageName,
    charImageTextPrompt,
    promptTemplates.charImage ?? DEFAULT_PROMPT_TEMPLATES.charImage
  );

  const handleImageUpload = () => {
    if (!imageFile) return;
    setUploading(true);
    setUploadError('');
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const result = reader.result as string;
        const [header, base64] = result.split(',');
        const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
        const char = novel.characters.find((c) => c.name === charImageName);
        if (char) await saveCharImage(novel.id, char.id, base64, mime);
        setUploadDone(true);
        setTimeout(() => {
          setUploadDone(false);
          setImageFile(null);
          setImagePreview('');
        }, 1500);
      } catch (e) {
        setUploadError(String(e));
      } finally {
        setUploading(false);
      }
    };
    reader.onerror = () => {
      setUploadError('파일 읽기 실패');
      setUploading(false);
    };
    reader.readAsDataURL(imageFile);
  };

  return (
    <div>
      <div
        style={{
          border: '1px solid var(--border)',
          padding: '14px 16px',
          marginBottom: 16,
          background: 'var(--cream)',
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: 'var(--ink-soft)',
            marginBottom: 6,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
          }}
        >
          스타일 프롬프트 (텍스트, ref 이미지와 함께 전달됨)
        </div>
        <textarea
          className="input-field"
          value={stylePromptInput}
          onChange={(e) => setStylePromptInput(e.target.value)}
          onBlur={() => {
            if (stylePromptInput !== (novel.stylePrompt || '')) {
              updateNovel(novel.id, { stylePrompt: stylePromptInput });
            }
          }}
          placeholder="e.g. cozy watercolor storybook illustration, soft pastel colors, hand-drawn outlines…"
          style={{ fontSize: 12, minHeight: 56, marginBottom: 14 }}
        />

        <div
          style={{
            fontSize: 11,
            color: 'var(--ink-soft)',
            marginBottom: 10,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
          }}
        >
          스타일 참고 이미지 (여러 장 추가 가능 — 자동 생성 품질에 영향)
        </div>
        <input
          ref={refImageRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleRefImageUpload(file);
            e.target.value = '';
          }}
        />
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {(novel.styleRefImages ?? []).map((img, i) => (
            <div
              key={img.id}
              style={{
                position: 'relative',
                width: 90,
                height: 90,
                border: '1px solid var(--border)',
                background: 'white',
                flexShrink: 0,
              }}
            >
              {/* biome-ignore lint/performance/noImgElement: preview only */}
              <img
                src={`data:${img.mime};base64,${img.base64}`}
                alt={`style ref ${i + 1}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
              <button
                type="button"
                onClick={() => removeStyleRefImage(novel.id, img.id)}
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: 'rgba(26,20,16,0.7)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
              >
                <X size={11} color="white" />
              </button>
            </div>
          ))}

          {/* biome-ignore lint/a11y/noStaticElementInteractions: internal tool */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: internal tool */}
          <div
            onClick={() => refImageRef.current?.click()}
            style={{
              width: 90,
              height: 90,
              border: '2px dashed var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor = 'var(--gold)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor = 'var(--border)')
            }
          >
            <Upload size={16} style={{ color: 'var(--ink-soft)' }} />
          </div>
        </div>
      </div>

      {novel.characters.length > 0 && (
        <div
          style={{
            border: '1px solid var(--border)',
            padding: '14px 16px',
            marginBottom: 20,
            background: 'var(--cream)',
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: 'var(--ink-soft)',
              marginBottom: 10,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
            }}
          >
            전체 캐릭터 자동 생성 ({pendingChars.length}명 남음)
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={handleAutoGenerate}
            disabled={autoRunning || pendingChars.length === 0}
            style={{
              fontSize: 12,
              padding: '7px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Sparkles size={12} />
            {autoRunning
              ? '생성 중…'
              : pendingChars.length === 0
                ? '모두 생성됨'
                : '자동 생성 + 다운로드'}
          </button>
          <AutoGenStatusList
            chars={novel.characters}
            status={Object.fromEntries(
              novel.characters.map((c) => [
                c.id,
                charStatus[c.id] ??
                  (c.imageGenerated
                    ? { state: 'done', message: '생성 완료!' }
                    : { state: 'pending' }),
              ])
            )}
            onRegenerate={handleRegenerate}
          />
        </div>
      )}

      <div
        style={{
          fontSize: 11,
          color: 'var(--ink-soft)',
          marginBottom: 8,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
        }}
      >
        캐릭터 선택
      </div>
      {novel.characters.length > 0 ? (
        <select
          value={charImageName}
          onChange={(e) => setCharImageName(e.target.value)}
          className="input-field"
          style={{ fontSize: 12, marginBottom: 16 }}
        >
          {novel.characters.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name} {c.imageGenerated || c.imageUrl ? '✓' : ''}
            </option>
          ))}
        </select>
      ) : (
        <p
          style={{
            fontSize: 12,
            color: 'var(--ink-soft)',
            opacity: 0.5,
            marginBottom: 16,
          }}
        >
          ③-0에서 먼저 캐릭터를 추출해주세요
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setImageFile(file);
          setImagePreview(URL.createObjectURL(file));
        }}
      />

      {/* biome-ignore lint/a11y/noStaticElementInteractions: internal tool */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: internal tool */}
      <div
        onClick={() => fileRef.current?.click()}
        style={{
          border: '2px dashed var(--border)',
          padding: '24px',
          textAlign: 'center',
          cursor: 'pointer',
          marginBottom: 12,
          background: 'white',
          transition: 'border-color 0.2s',
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.borderColor = 'var(--gold)')
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.borderColor = 'var(--border)')
        }
      >
        {imagePreview ? (
          // biome-ignore lint/performance/noImgElement: preview only
          <img
            src={imagePreview}
            alt="preview"
            style={{
              maxHeight: 160,
              maxWidth: '100%',
              objectFit: 'contain',
            }}
          />
        ) : (
          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            클릭해서 이미지 선택
          </span>
        )}
      </div>

      <PromptBox
        prompt={charImagePrompt}
        label="Gemini에 붙여넣을 프롬프트"
        templateKey="charImage"
        vars={{
          style,
          charImageName: charImageName || '(이름)',
          charImageTextPrompt:
            charImageTextPrompt ||
            '(④ 단계에서 텍스트 프롬프트를 먼저 생성해주세요)',
        }}
      />

      {uploadError && (
        <div
          style={{
            marginBottom: 8,
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

      <button
        type="button"
        className="btn-primary"
        onClick={handleImageUpload}
        disabled={!imageFile || uploading || novel.characters.length === 0}
        style={{
          fontSize: 12,
          padding: '7px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {uploadDone ? (
          <>
            <Check size={12} /> 저장됨!
          </>
        ) : uploading ? (
          '업로드 중…'
        ) : (
          'Firebase에 저장'
        )}
      </button>
    </div>
  );
}
