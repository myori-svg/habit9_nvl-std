'use client';
import { Check } from 'lucide-react';
import {
  buildCharInfoPrompt,
  DEFAULT_PROMPT_TEMPLATES,
  extractCharNames,
} from '@/lib/prompts';
import { useStore } from '@/lib/store';
import type { Novel } from '@/types';
import CharImageStep from './CharImageStep';
import CharPromptStep from './CharPromptStep';
import { PromptBox, SaveCharInfoBox } from './shared';

interface Props {
  novel: Novel;
  charSubStep: 'extract' | 'info' | 'prompt' | 'image';
  setCharSubStep: React.Dispatch<
    React.SetStateAction<'extract' | 'info' | 'prompt' | 'image'>
  >;
  charExtractInput: string;
  setCharExtractInput: React.Dispatch<React.SetStateAction<string>>;
  extractedChars: string[];
  setExtractedChars: React.Dispatch<React.SetStateAction<string[]>>;
  charInfoNames: string[];
  setCharInfoNames: React.Dispatch<React.SetStateAction<string[]>>;
  charPromptName: string;
  setCharPromptName: React.Dispatch<React.SetStateAction<string>>;
  charPromptInfo: string;
  setCharPromptInfo: React.Dispatch<React.SetStateAction<string>>;
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

export default function CharInfoStep({
  novel,
  charSubStep,
  setCharSubStep,
  charExtractInput,
  setCharExtractInput,
  extractedChars,
  setExtractedChars,
  charInfoNames,
  setCharInfoNames,
  charPromptName,
  setCharPromptName,
  charPromptInfo,
  setCharPromptInfo,
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
  const { updateNovel, promptTemplates } = useStore();
  const charInfoTemplate =
    promptTemplates.charInfo ?? DEFAULT_PROMPT_TEMPLATES.charInfo;

  const charInfoPrompts = charInfoNames.map((name) => ({
    name,
    prompt: buildCharInfoPrompt(novel.title, name, charInfoTemplate),
  }));

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {(['extract', 'info', 'prompt', 'image'] as const).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setCharSubStep(t)}
            style={{
              padding: '6px 14px',
              cursor: 'pointer',
              fontSize: 12,
              background: charSubStep === t ? 'var(--gold)' : 'white',
              color: charSubStep === t ? 'var(--ink)' : 'var(--ink-soft)',
              border: '1px solid',
              borderColor: charSubStep === t ? 'var(--gold)' : 'var(--border)',
              transition: 'all 0.15s',
            }}
          >
            {t === 'extract'
              ? '③-0 캐릭터 목록 추출'
              : t === 'info'
                ? '③-1 캐릭터 정보'
                : t === 'prompt'
                  ? '③-2 캐릭터 프롬프트'
                  : '③-3 캐릭터 이미지'}
          </button>
        ))}
      </div>

      {/* ③-0 */}
      {charSubStep === 'extract' && (
        <div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--ink-soft)',
              marginBottom: 6,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
            }}
          >
            구도 프롬프트 붙여넣기
          </div>
          <textarea
            className="input-field"
            value={charExtractInput}
            onChange={(e) => {
              setCharExtractInput(e.target.value);
              setExtractedChars(extractCharNames(e.target.value));
            }}
            placeholder="② 단계에서 생성한 구도 프롬프트를 붙여넣으세요"
            style={{ fontSize: 12, minHeight: 120, marginBottom: 12 }}
          />

          {extractedChars.length > 0 && (
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
                추출된 캐릭터
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {extractedChars.map((name) => {
                  const exists = novel.characters.some((c) => c.name === name);
                  return (
                    <div
                      key={name}
                      style={{
                        padding: '5px 12px',
                        fontSize: 12,
                        border: '1px solid',
                        borderColor: exists ? 'var(--sage)' : 'var(--gold)',
                        background: exists
                          ? 'rgba(74,103,65,0.08)'
                          : 'rgba(201,168,76,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {exists ? (
                        <Check size={10} style={{ color: 'var(--sage)' }} />
                      ) : null}
                      {name}
                      <span style={{ fontSize: 10, opacity: 0.6 }}>
                        {exists ? '이미 있음' : '새 캐릭터'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {extractedChars.some(
            (name) => !novel.characters.some((c) => c.name === name)
          ) && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                const newChars = extractedChars
                  .filter(
                    (name) => !novel.characters.some((c) => c.name === name)
                  )
                  .map((name) => ({
                    id: crypto.randomUUID(),
                    name,
                    info: '',
                    textPrompt: '',
                    createdAt: new Date().toISOString(),
                  }));
                updateNovel(novel.id, {
                  characters: [...novel.characters, ...newChars],
                });
              }}
              style={{
                fontSize: 12,
                padding: '7px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Check size={12} /> 새 캐릭터 저장
            </button>
          )}
        </div>
      )}

      {/* ③-1 */}
      {charSubStep === 'info' && (
        <div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--ink-soft)',
              marginBottom: 8,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
            }}
          >
            캐릭터 선택 (정보 미생성 캐릭터만 선택 가능)
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              marginBottom: 16,
            }}
          >
            {novel.characters.length === 0 && (
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--ink-soft)',
                  opacity: 0.5,
                }}
              >
                ③-0에서 먼저 캐릭터를 추출해주세요
              </p>
            )}
            {novel.characters.map((c) => {
              const hasInfo = !!c.info;
              const selected = charInfoNames.includes(c.name);
              return (
                // biome-ignore lint/a11y/noStaticElementInteractions: internal tool
                // biome-ignore lint/a11y/useKeyWithClickEvents: internal tool
                <div
                  key={c.id}
                  onClick={() => {
                    if (hasInfo) return;
                    setCharInfoNames((prev) =>
                      selected
                        ? prev.filter((n) => n !== c.name)
                        : [...prev, c.name]
                    );
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    border: '1px solid',
                    borderColor: selected ? 'var(--gold)' : 'var(--border)',
                    background: hasInfo
                      ? 'var(--parchment)'
                      : selected
                        ? 'rgba(201,168,76,0.08)'
                        : 'white',
                    cursor: hasInfo ? 'not-allowed' : 'pointer',
                    opacity: hasInfo ? 0.5 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      border: '1px solid',
                      borderColor: selected ? 'var(--gold)' : 'var(--border)',
                      background: selected ? 'var(--gold)' : 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {selected && (
                      <Check size={10} style={{ color: 'var(--ink)' }} />
                    )}
                  </div>
                  <span style={{ fontSize: 13, flex: 1 }}>{c.name}</span>
                  {hasInfo && (
                    <span style={{ fontSize: 10, color: 'var(--sage)' }}>
                      정보 있음
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {charInfoPrompts.length === 1 && (
            <PromptBox
              label="Gemini에 붙여넣을 프롬프트"
              prompt={charInfoPrompts[0].prompt}
              templateKey="charInfo"
              vars={{ novelTitle: novel.title, name: charInfoPrompts[0].name }}
            />
          )}
          {charInfoPrompts.length > 1 && (
            <PromptBox
              label="Gemini에 붙여넣을 프롬프트"
              prompt={charInfoPrompts
                .map(({ name, prompt }) => `[${name}]\n${prompt}`)
                .join('\n\n===\n\n')}
            />
          )}
          <SaveCharInfoBox novel={novel} />
        </div>
      )}

      {/* ③-2 */}
      {charSubStep === 'prompt' && (
        <CharPromptStep
          novel={novel}
          charPromptName={charPromptName}
          setCharPromptName={setCharPromptName}
          charPromptInfo={charPromptInfo}
          setCharPromptInfo={setCharPromptInfo}
        />
      )}

      {/* ③-3 */}
      {charSubStep === 'image' && (
        <CharImageStep
          novel={novel}
          charImageName={charImageName}
          setCharImageName={setCharImageName}
          imageFile={imageFile}
          setImageFile={setImageFile}
          imagePreview={imagePreview}
          setImagePreview={setImagePreview}
          uploading={uploading}
          setUploading={setUploading}
          uploadDone={uploadDone}
          setUploadDone={setUploadDone}
        />
      )}
    </div>
  );
}
