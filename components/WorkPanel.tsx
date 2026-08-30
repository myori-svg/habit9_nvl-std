'use client';
import { Download, RefreshCw, Sparkles, Square } from 'lucide-react';
import { useRef, useState } from 'react';
import { extractCharNames, splitCompositionScenes } from '@/lib/prompts';
import { useStore } from '@/lib/store';
import { withTimeout } from '@/lib/withTimeout';
import type {
  Character,
  DiscussionQuestion,
  Novel,
  NovelPart,
  SceneImage,
  SceneSlot,
} from '@/types';
import {
  type AutoGenCharStatus,
  AutoGenStatusList,
} from './ManualPanel/shared';

interface Props {
  novel: Novel;
}

const DQ_GEN_KEY = 'dq-generation';
const SAVE_TIMEOUT_MS = 45000;

const SLOT_LABELS: Record<SceneSlot, string> = {
  main: '본문',
  optionA: 'Option A',
  optionB: 'Option B',
};

interface WorkItem {
  dqId: string;
  slot: SceneSlot;
  text: string;
  label: string;
}

function buildWorkItems(dqs: DiscussionQuestion[]): WorkItem[] {
  const items: WorkItem[] = [];
  dqs.forEach((dq, i) => {
    const split = splitCompositionScenes(dq.compositionPrompt);
    (
      [
        ['main', split.main],
        ['optionA', split.optionA],
        ['optionB', split.optionB],
      ] as [SceneSlot, string][]
    ).forEach(([slot, text]) => {
      if (!text) return;
      items.push({
        dqId: dq.id,
        slot,
        text,
        label: `Q${i + 1} · ${SLOT_LABELS[slot]}`,
      });
    });
  });
  return items;
}

// 캐릭터 참고 이미지를 base64로 확보한다. in-memory(imageBase64)가 있으면
// 그대로 쓰고, 없으면(새로고침 등으로 날아간 경우) 영구 저장된 imageUrl에서
// 다시 받아온다. 같은 캐릭터를 여러 장면에서 쓸 때 반복 요청하지 않도록 캐싱.
async function resolveCharImage(
  char: Character,
  cache: Map<string, { base64?: string; mime?: string }>
): Promise<{ base64?: string; mime?: string }> {
  if (char.imageBase64)
    return { base64: char.imageBase64, mime: char.imageMime };
  const cached = cache.get(char.id);
  if (cached) return cached;
  if (!char.imageUrl) return {};
  try {
    const res = await fetch(
      `/api/fetch-image?url=${encodeURIComponent(char.imageUrl)}`
    );
    if (!res.ok) return {};
    const { data, mimeType } = await res.json();
    const resolved = { base64: data as string, mime: mimeType as string };
    cache.set(char.id, resolved);
    return resolved;
  } catch {
    return {};
  }
}

export default function WorkPanel({ novel }: Props) {
  const { addHistory, promptTemplates, setPartDQs, saveDQSceneImage } =
    useStore();
  const [selectedPartId, setSelectedPartId] = useState<string>(
    novel.parts[0]?.id ?? ''
  );
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineError, setPipelineError] = useState('');
  const [itemStatus, setItemStatus] = useState<
    Record<string, AutoGenCharStatus>
  >({});
  const [pipelineItems, setPipelineItems] = useState<WorkItem[]>([]);
  const stopRequested = useRef(false);

  const selectedPart = novel.parts.find((p) => p.id === selectedPartId);

  const selectPart = (partId: string) => {
    setSelectedPartId(partId);
    setItemStatus({});
    setPipelineItems([]);
    setPipelineError('');
  };

  // ── 장면 이미지 1장 생성 (파이프라인 루프 / 개별 재생성 둘 다 이걸 씀) ──
  const generateSceneForSlot = async (
    part: NovelPart,
    dqId: string,
    slot: SceneSlot,
    text: string,
    label: string,
    charCache: Map<string, { base64?: string; mime?: string }>
  ): Promise<void> => {
    const key = `${dqId}:${slot}`;
    setItemStatus((prev) => ({
      ...prev,
      [key]: { state: 'running', message: '장면 생성 중…' },
    }));
    try {
      const mentioned = novel.characters.filter((c) =>
        extractCharNames(text).some(
          (m) => m.toLowerCase() === c.name.toLowerCase()
        )
      );
      const resolvedChars = await Promise.all(
        mentioned.map(async (c) => {
          const img = await resolveCharImage(c, charCache);
          return {
            name: c.name,
            textPrompt: c.textPrompt,
            imageBase64: img.base64,
            imageMime: img.mime,
          };
        })
      );

      const res = await fetch('/api/generate-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          styleRefImages: novel.styleRefImages,
          stylePrompt: novel.stylePrompt,
          compositionPrompt: text,
          characters: resolvedChars,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      await withTimeout(
        saveDQSceneImage(
          novel.id,
          part.id,
          dqId,
          slot,
          data.imageBase64,
          data.imageMime
        ),
        SAVE_TIMEOUT_MS,
        '이미지 저장'
      );
      addHistory({
        novelId: novel.id,
        novelTitle: novel.title,
        type: 'scene',
        label: `${part.label} — ${label}`,
        imageBase64: data.imageBase64,
        imageMime: data.imageMime,
        prompt: text,
      });
      setItemStatus((prev) => ({
        ...prev,
        [key]: { state: 'done', message: '완료' },
      }));
    } catch (e) {
      setItemStatus((prev) => ({
        ...prev,
        [key]: { state: 'error', message: String(e) },
      }));
    }
  };

  // ── ①DQ+구도 생성 → ④장면 이미지(DQ당 3장) 순서로 이어지는 자동 파이프라인 ──
  const runAutoPipeline = async () => {
    if (!selectedPart?.content) return;
    stopRequested.current = false;
    setPipelineRunning(true);
    setPipelineError('');
    setPipelineItems([]);
    setItemStatus({
      [DQ_GEN_KEY]: { state: 'running', message: 'DQ+구도 생성 중…' },
    });

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

      const newDQs = await setPartDQs(
        novel.id,
        selectedPart.id,
        data.discussionQuestions
      );
      setItemStatus((prev) => ({
        ...prev,
        [DQ_GEN_KEY]: {
          state: 'done',
          message: `DQ ${newDQs.length}개 생성 완료`,
        },
      }));

      const items = buildWorkItems(newDQs);
      setPipelineItems(items);
      setItemStatus((prev) => ({
        ...prev,
        ...Object.fromEntries(
          items.map((it) => [
            `${it.dqId}:${it.slot}`,
            { state: 'pending' as const },
          ])
        ),
      }));

      const charCache = new Map<string, { base64?: string; mime?: string }>();
      for (const item of items) {
        if (stopRequested.current) {
          setItemStatus((prev) => ({
            ...prev,
            [`${item.dqId}:${item.slot}`]: {
              state: 'error',
              message: '중지됨',
            },
          }));
          continue;
        }
        await generateSceneForSlot(
          selectedPart,
          item.dqId,
          item.slot,
          item.text,
          item.label,
          charCache
        );
      }
    } catch (e) {
      setPipelineError(String(e));
      setItemStatus((prev) => ({
        ...prev,
        [DQ_GEN_KEY]: { state: 'error', message: String(e) },
      }));
    } finally {
      setPipelineRunning(false);
    }
  };

  const handleStop = () => {
    stopRequested.current = true;
  };

  const handleRegenerateSlot = (dq: DiscussionQuestion, slot: SceneSlot) => {
    if (!selectedPart) return;
    const split = splitCompositionScenes(dq.compositionPrompt);
    const text =
      slot === 'main'
        ? split.main
        : slot === 'optionA'
          ? split.optionA
          : split.optionB;
    if (!text) return;
    generateSceneForSlot(
      selectedPart,
      dq.id,
      slot,
      text,
      `${dq.text.slice(0, 30)}… · ${SLOT_LABELS[slot]}`,
      new Map()
    );
  };

  const downloadImage = (base64: string, mime: string, name: string) => {
    const ext = mime.split('/')[1] || 'png';
    const a = document.createElement('a');
    a.href = `data:${mime};base64,${base64}`;
    a.download = `${name}.${ext}`;
    a.click();
  };

  const statusChars = [
    { id: DQ_GEN_KEY, name: '① DQ + 구도 프롬프트' },
    ...pipelineItems.map((it) => ({
      id: `${it.dqId}:${it.slot}`,
      name: it.label,
    })),
  ];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Part selector */}
      <div
        style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}
      >
        {novel.parts.map((part) => (
          <button
            type="button"
            key={part.id}
            onClick={() => selectPart(part.id)}
            style={{
              padding: '8px 14px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              background: selectedPartId === part.id ? 'var(--ink)' : 'white',
              color:
                selectedPartId === part.id
                  ? 'var(--parchment)'
                  : 'var(--ink-soft)',
              border: '1px solid',
              borderColor:
                selectedPartId === part.id ? 'var(--ink)' : 'var(--border)',
              transition: 'all 0.15s',
            }}
          >
            {part.label}
          </button>
        ))}
      </div>

      {!selectedPart ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 200,
            opacity: 0.4,
          }}
        >
          <p className="serif" style={{ fontSize: 16, fontWeight: 300 }}>
            챕터를 선택하세요
          </p>
        </div>
      ) : (
        <>
          {/* Run pipeline */}
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--ink-soft)',
                marginBottom: 10,
              }}
            >
              자동 생성 — DQ → 구도 프롬프트 → 장면 이미지(DQ당 3장)
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn-gold"
                onClick={runAutoPipeline}
                disabled={pipelineRunning || !selectedPart.content}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  padding: '9px 18px',
                }}
              >
                {pipelineRunning ? (
                  <RefreshCw
                    size={12}
                    style={{ animation: 'spin 1s linear infinite' }}
                  />
                ) : (
                  <Sparkles size={12} />
                )}
                {pipelineRunning
                  ? '생성 중…'
                  : selectedPart.discussionQuestions.length > 0
                    ? '전체 다시 생성'
                    : '전체 자동 생성'}
              </button>
              {pipelineRunning && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={handleStop}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    padding: '9px 18px',
                  }}
                >
                  <Square size={12} /> 중지
                </button>
              )}
            </div>
            {!selectedPart.content && (
              <p
                style={{
                  fontSize: 11,
                  color: 'var(--ink-soft)',
                  opacity: 0.6,
                  margin: '8px 0 0',
                }}
              >
                이 챕터에 원문 내용이 없어서 자동 생성을 할 수 없어요.
              </p>
            )}
            {pipelineError && (
              <div
                style={{
                  marginTop: 10,
                  padding: '8px 12px',
                  background: '#fff5f5',
                  border: '1px solid #fcc',
                  fontSize: 11,
                  color: 'var(--crimson)',
                }}
              >
                {pipelineError}
              </div>
            )}
            {Object.keys(itemStatus).length > 0 && (
              <AutoGenStatusList chars={statusChars} status={itemStatus} />
            )}
          </div>

          {/* Results */}
          {selectedPart.discussionQuestions.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 160,
                opacity: 0.4,
              }}
            >
              <p className="serif" style={{ fontSize: 15, fontWeight: 300 }}>
                아직 생성된 DQ가 없어요
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {selectedPart.discussionQuestions.map((dq, i) => (
                <DQCard
                  key={dq.id}
                  index={i}
                  dq={dq}
                  itemStatus={itemStatus}
                  onRegenerate={(slot) => handleRegenerateSlot(dq, slot)}
                  onDownload={downloadImage}
                />
              ))}
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function DQCard({
  index,
  dq,
  itemStatus,
  onRegenerate,
  onDownload,
}: {
  index: number;
  dq: DiscussionQuestion;
  itemStatus: Record<string, AutoGenCharStatus>;
  onRegenerate: (slot: SceneSlot) => void;
  onDownload: (base64: string, mime: string, name: string) => void;
}) {
  const split = splitCompositionScenes(dq.compositionPrompt);
  const slotTexts: Record<SceneSlot, string> = {
    main: split.main,
    optionA: split.optionA,
    optionB: split.optionB,
  };

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <span
          style={{
            fontSize: 11,
            color: 'var(--gold)',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          Q{index + 1}
        </span>
        <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>{dq.text}</p>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {(['main', 'optionA', 'optionB'] as SceneSlot[]).map((slot) => {
          const text = slotTexts[slot];
          if (!text) return null;
          return (
            <SceneSlotCard
              key={slot}
              slot={slot}
              text={text}
              image={dq.sceneImages?.[slot]}
              status={itemStatus[`${dq.id}:${slot}`]}
              onRegenerate={() => onRegenerate(slot)}
              onDownload={(base64, mime) =>
                onDownload(base64, mime, `scene-Q${index + 1}-${slot}`)
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function SceneSlotCard({
  slot,
  image,
  status,
  onRegenerate,
  onDownload,
}: {
  slot: SceneSlot;
  text: string;
  image?: SceneImage;
  status?: AutoGenCharStatus;
  onRegenerate: () => void;
  onDownload: (base64: string, mime: string) => void;
}) {
  const running = status?.state === 'running';
  const imgSrc = image?.base64
    ? `data:${image.mime || 'image/png'};base64,${image.base64}`
    : image?.url;

  return (
    <div style={{ flex: '1 1 180px', minWidth: 160 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: 'var(--ink-soft)',
          marginBottom: 6,
        }}
      >
        {SLOT_LABELS[slot]}
      </div>
      {running ? (
        <div
          className="loading-shimmer"
          style={{ width: '100%', aspectRatio: '16/9' }}
        />
      ) : imgSrc ? (
        <div style={{ position: 'relative' }}>
          {/* biome-ignore lint/performance/noImgElement: dynamic base64/URL image, not eligible for next/image optimization */}
          <img
            src={imgSrc}
            alt={SLOT_LABELS[slot]}
            style={{
              width: '100%',
              aspectRatio: '16/9',
              objectFit: 'cover',
              display: 'block',
              border: '1px solid var(--border)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 6,
              right: 6,
              display: 'flex',
              gap: 4,
            }}
          >
            {image?.base64 && (
              <button
                type="button"
                onClick={() =>
                  onDownload(image.base64 as string, image.mime || 'image/png')
                }
                style={iconBtnStyle}
                aria-label="다운로드"
              >
                <Download size={11} />
              </button>
            )}
            <button
              type="button"
              onClick={onRegenerate}
              style={iconBtnStyle}
              aria-label="재생성"
            >
              <RefreshCw size={11} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onRegenerate}
          style={{
            width: '100%',
            aspectRatio: '16/9',
            border: '1px dashed var(--border)',
            background: status?.state === 'error' ? '#fff5f5' : 'var(--cream)',
            color:
              status?.state === 'error' ? 'var(--crimson)' : 'var(--ink-soft)',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          {status?.state === 'error' ? '실패 — 재시도' : '이미지 생성'}
        </button>
      )}
    </div>
  );
}

const iconBtnStyle = {
  width: 22,
  height: 22,
  borderRadius: '50%',
  background: 'rgba(26,20,16,0.7)',
  border: 'none',
  color: 'white',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
} as const;
