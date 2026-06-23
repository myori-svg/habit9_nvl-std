'use client';
import { useEffect, useState } from 'react';
import type { Novel } from '@/types';
import CharInfoStep from './CharInfoStep';
import CompositionStep from './CompositionStep';
import DQStep from './DQStep';
import SceneStep from './SceneStep';

type ActiveStep = 'dq' | 'composition' | 'char-info' | 'scene';

const STEPS = [
  { id: 'dq', label: '① DQ 생성', desc: 'Discussion Question 생성 프롬프트' },
  {
    id: 'composition',
    label: '② 구도 프롬프트',
    desc: '장면 구도 생성 프롬프트',
  },
  {
    id: 'char-info',
    label: '③ 캐릭터 관리',
    desc: '캐릭터 추출 / 정보 수집 / 프롬프트 작성 / 이미지 업로드',
  },
  {
    id: 'scene',
    label: '④ 장면 생성',
    desc: '최종 장면 이미지 생성 프롬프트 조립',
  },
] as const;

interface Props {
  novel: Novel;
}

export default function ManualPanel({ novel }: Props) {
  const [activeStep, setActiveStep] = useState<ActiveStep>('dq');

  // Step 1
  const [dqChapters, setDqChapters] = useState<string[]>([]);
  const [dqCustomSummary, setDqCustomSummary] = useState('');

  // Step 2
  const [compPartId, setCompPartId] = useState(novel.parts[0]?.id ?? '');
  const [compCustomDQ, setCompCustomDQ] = useState('');

  // Step 3
  const [charSubStep, setCharSubStep] = useState<
    'extract' | 'info' | 'prompt' | 'image'
  >('extract');
  const [charExtractInput, setCharExtractInput] = useState('');
  const [extractedChars, setExtractedChars] = useState<string[]>([]);
  const [charInfoNames, setCharInfoNames] = useState<string[]>([]);
  const [charPromptName, setCharPromptName] = useState(
    novel.characters[0]?.name ?? ''
  );
  const [charPromptInfo, setCharPromptInfo] = useState(
    novel.characters[0]?.info ?? ''
  );
  const [charImageName, setCharImageName] = useState(
    novel.characters[0]?.name ?? ''
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);

  // Step 4
  const [scenePartId, setScenePartId] = useState(novel.parts[0]?.id ?? '');
  const [sceneDQId, setSceneDQId] = useState('');
  const [sceneComposition, setSceneComposition] = useState('');
  const [sceneCharIds, setSceneCharIds] = useState<string[]>([]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally resets only on novel switch
  useEffect(() => {
    setActiveStep('dq');
    setDqChapters([]);
    setDqCustomSummary('');
    setCompPartId(novel.parts[0]?.id ?? '');
    setCompCustomDQ('');
    setCharSubStep('extract');
    setCharExtractInput('');
    setExtractedChars([]);
    setCharInfoNames([]);
    setCharPromptName(novel.characters[0]?.name ?? '');
    setCharPromptInfo(novel.characters[0]?.info ?? '');
    setCharImageName(novel.characters[0]?.name ?? '');
    setImageFile(null);
    setImagePreview('');
    setUploading(false);
    setUploadDone(false);
    setScenePartId(novel.parts[0]?.id ?? '');
    setSceneDQId('');
    setSceneComposition('');
    setSceneCharIds([]);
  }, [novel.id]);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h2
          className="serif"
          style={{ fontSize: 26, fontWeight: 300, margin: '0 0 6px' }}
        >
          Manual Mode — {novel.title}
        </h2>
        <p
          style={{
            fontSize: 13,
            color: 'var(--ink-soft)',
            margin: 0,
            opacity: 0.7,
          }}
        >
          각 단계의 프롬프트를 복사해서 Gemini에 직접 붙여넣고, 결과를 다시
          저장할 수 있어요.
        </p>
      </div>

      <div
        style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}
      >
        {STEPS.map((step) => (
          <button
            type="button"
            key={step.id}
            onClick={() => setActiveStep(step.id as ActiveStep)}
            style={{
              padding: '8px 14px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              background: activeStep === step.id ? 'var(--ink)' : 'white',
              color:
                activeStep === step.id ? 'var(--parchment)' : 'var(--ink-soft)',
              border: '1px solid',
              borderColor:
                activeStep === step.id ? 'var(--ink)' : 'var(--border)',
              transition: 'all 0.15s',
            }}
          >
            {step.label}
          </button>
        ))}
      </div>

      <div
        style={{
          padding: '10px 14px',
          background: 'rgba(201,168,76,0.08)',
          border: '1px solid rgba(201,168,76,0.2)',
          marginBottom: 20,
          fontSize: 12,
          color: 'var(--ink-soft)',
        }}
      >
        {STEPS.find((s) => s.id === activeStep)?.desc}
      </div>

      <div className="card" style={{ padding: 24 }}>
        {activeStep === 'dq' && (
          <DQStep
            novel={novel}
            dqChapters={dqChapters}
            setDqChapters={setDqChapters}
            dqCustomSummary={dqCustomSummary}
            setDqCustomSummary={setDqCustomSummary}
          />
        )}
        {activeStep === 'composition' && (
          <CompositionStep
            novel={novel}
            compPartId={compPartId}
            setCompPartId={setCompPartId}
            compCustomDQ={compCustomDQ}
            setCompCustomDQ={setCompCustomDQ}
          />
        )}
        {activeStep === 'char-info' && (
          <CharInfoStep
            novel={novel}
            charSubStep={charSubStep}
            setCharSubStep={setCharSubStep}
            charExtractInput={charExtractInput}
            setCharExtractInput={setCharExtractInput}
            extractedChars={extractedChars}
            setExtractedChars={setExtractedChars}
            charInfoNames={charInfoNames}
            setCharInfoNames={setCharInfoNames}
            charPromptName={charPromptName}
            setCharPromptName={setCharPromptName}
            charPromptInfo={charPromptInfo}
            setCharPromptInfo={setCharPromptInfo}
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
        {activeStep === 'scene' && (
          <SceneStep
            novel={novel}
            scenePartId={scenePartId}
            setScenePartId={setScenePartId}
            sceneDQId={sceneDQId}
            setSceneDQId={setSceneDQId}
            sceneComposition={sceneComposition}
            setSceneComposition={setSceneComposition}
            sceneCharIds={sceneCharIds}
            setSceneCharIds={setSceneCharIds}
          />
        )}
      </div>
    </div>
  );
}
