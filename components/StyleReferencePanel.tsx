'use client';
import { ChevronRight, Palette, RefreshCw, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import type { Novel } from '@/types';

function readImageFile(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const [header, base64] = (reader.result as string).split(',');
      resolve({ base64, mime: header.match(/:(.*?);/)?.[1] || 'image/jpeg' });
    };
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsDataURL(file);
  });
}

const sectionLabelStyle = {
  fontSize: 11,
  color: 'var(--ink-soft)',
  letterSpacing: '0.07em',
  textTransform: 'uppercase' as const,
};

const tileButtonStyle = {
  position: 'absolute' as const,
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
};

// 스타일 프롬프트(텍스트)와 스타일 참고 이미지 관리. 참고 이미지는 이미지 생성 때
// 텍스트와 함께 전달되며, 각 이미지는 위치를 유지한 채 교체하거나 제거할 수 있다.
export function StyleReferenceFields({ novel }: { novel: Novel }) {
  const {
    updateNovel,
    addStyleRefImage,
    removeStyleRefImage,
    replaceStyleRefImage,
  } = useStore();
  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetId = useRef<string | null>(null);
  const [stylePromptInput, setStylePromptInput] = useState(
    novel.stylePrompt || ''
  );

  useEffect(() => {
    setStylePromptInput(novel.stylePrompt || '');
  }, [novel.stylePrompt]);

  const handleAddFiles = async (files: FileList | null) => {
    for (const file of Array.from(files ?? [])) {
      const { base64, mime } = await readImageFile(file);
      addStyleRefImage(novel.id, base64, mime);
    }
  };

  const handleReplaceFile = async (file: File | undefined) => {
    const imageId = replaceTargetId.current;
    replaceTargetId.current = null;
    if (!file || !imageId) return;
    const { base64, mime } = await readImageFile(file);
    replaceStyleRefImage(novel.id, imageId, base64, mime);
  };

  return (
    <div>
      <div style={{ ...sectionLabelStyle, marginBottom: 6 }}>
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

      <div style={{ ...sectionLabelStyle, marginBottom: 10 }}>
        스타일 참고 이미지 (여러 장 추가 가능 — 자동 생성 품질에 영향)
      </div>
      <input
        ref={addInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          handleAddFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          handleReplaceFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {(novel.styleRefImages ?? []).map((img, i) => (
          <div
            key={img.id}
            style={{
              position: 'relative',
              width: 90,
              height: 90,
              background: 'white',
              flexShrink: 0,
            }}
          >
            {/* biome-ignore lint/performance/noImgElement: preview only */}
            <img
              src={`data:${img.mime};base64,${img.base64}`}
              alt={`style ref ${i + 1}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <button
              type="button"
              aria-label={`참고 이미지 ${i + 1} 교체`}
              title="다른 이미지로 교체 (순서 유지)"
              onClick={() => {
                replaceTargetId.current = img.id;
                replaceInputRef.current?.click();
              }}
              style={{ ...tileButtonStyle, top: 2, left: 2 }}
            >
              <RefreshCw size={10} color="white" />
            </button>
            <button
              type="button"
              aria-label={`참고 이미지 ${i + 1} 제거`}
              title="제거"
              onClick={() => removeStyleRefImage(novel.id, img.id)}
              style={{ ...tileButtonStyle, top: 2, right: 2 }}
            >
              <X size={11} color="white" />
            </button>
            <span
              style={{
                position: 'absolute',
                bottom: 2,
                left: 4,
                fontSize: 10,
                color: 'white',
                textShadow: '0 0 3px rgba(26,20,16,0.9)',
              }}
            >
              {i + 1}
            </span>
          </div>
        ))}

        <button
          type="button"
          aria-label="스타일 참고 이미지 추가"
          onClick={() => addInputRef.current?.click()}
          style={{
            width: 90,
            height: 90,
            border: '2px dashed var(--border)',
            background: 'transparent',
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
        </button>
      </div>
    </div>
  );
}

// 노션의 "콜아웃 안의 토글"처럼, 색이 깔린 상자 안에서 접었다 펼 수 있다. 접힌
// 상태에서도 올려 둔 참고 이미지가 작은 미리보기로 보인다.
export function StyleReferenceCallout({ novel }: { novel: Novel }) {
  const [open, setOpen] = useState(false);
  const images = novel.styleRefImages ?? [];
  const previewLimit = 6;

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '14px 16px',
        marginBottom: 16,
        background: 'rgba(201,168,76,0.1)',
      }}
    >
      <Palette
        size={16}
        style={{ color: 'var(--ink-soft)', flexShrink: 0, marginTop: 2 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            color: 'var(--ink)',
          }}
        >
          <ChevronRight
            size={14}
            style={{
              flexShrink: 0,
              transition: 'transform 0.15s',
              transform: open ? 'rotate(90deg)' : 'none',
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 500 }}>
            스타일 · 참고 이미지
          </span>
          <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
            {images.length > 0 ? `${images.length}장 적용 중` : '없음'}
          </span>
          {!open && images.length > 0 && (
            <span
              style={{
                display: 'flex',
                gap: 4,
                marginLeft: 'auto',
                alignItems: 'center',
              }}
            >
              {images.slice(0, previewLimit).map((img, i) => (
                // biome-ignore lint/performance/noImgElement: preview only
                <img
                  key={img.id}
                  src={`data:${img.mime};base64,${img.base64}`}
                  alt={`style ref ${i + 1}`}
                  style={{ width: 32, height: 32, objectFit: 'cover' }}
                />
              ))}
              {images.length > previewLimit && (
                <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                  +{images.length - previewLimit}
                </span>
              )}
            </span>
          )}
        </button>
        {open && (
          <div style={{ marginTop: 14 }}>
            <StyleReferenceFields novel={novel} />
          </div>
        )}
      </div>
    </div>
  );
}
