'use client';
import { Download, RefreshCw, Sparkles, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { splitCompositionScenes } from '@/lib/output-format';
import {
  extractCharNames,
  getPromptedCharacterNames,
  resolvePromptTemplate,
} from '@/lib/prompts';
import { useStore } from '@/lib/store';
import type { DiscussionQuestion, Novel, SceneImage, SceneSlot } from '@/types';
import {
  type AutoGenCharStatus,
  AutoGenStatusList,
  TemplateFallbackNotice,
} from './ManualPanel/shared';
import { StyleReferenceCallout } from './StyleReferencePanel';

interface Props {
  novel: Novel;
}

const DQ_GEN_KEY = 'dq-generation';

const SLOT_LABELS: Record<SceneSlot, string> = {
  main: '본문',
  optionA: 'Option A',
  optionB: 'Option B',
};

interface WorkItem {
  dqId: string;
  dqIndex: number;
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
        dqIndex: i,
        slot,
        text,
        label: `Q${i + 1} · ${SLOT_LABELS[slot]}`,
      });
    });
  });
  return items;
}

export default function WorkPanel({ novel }: Props) {
  const { promptTemplates, setPartDQs } = useStore();
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
  const dqTemplateMissing = resolvePromptTemplate(
    'dq',
    promptTemplates.dq
  ).missing;
  const compositionTemplateMissing = resolvePromptTemplate(
    'composition',
    promptTemplates.composition
  ).missing;

  const selectPart = (partId: string) => {
    setSelectedPartId(partId);
    setItemStatus({});
    setPipelineItems([]);
    setPipelineError('');
  };

  // 백그라운드 생성이 끝나면 Firestore 실시간 구독을 거쳐 novel prop이 갱신된다.
  // 'running'으로 표시해 둔 항목 중 해당 슬롯에 결과(url/error)가 도착한 것만
  // 완료/실패로 바꾼다 — 화면이 켜져 있는 동안은 물론, 나갔다 돌아왔을 때도 이
  // 렌더에서 바로 반영된다.
  useEffect(() => {
    setItemStatus((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [key, status] of Object.entries(prev)) {
        if (status.state !== 'running') continue;
        const [dqId, slot] = key.split(':') as [string, SceneSlot];
        const image = selectedPart?.discussionQuestions.find(
          (d) => d.id === dqId
        )?.sceneImages?.[slot];
        if (image?.url) {
          next[key] = { state: 'done', message: '완료 — 자동 저장됨' };
          changed = true;
        } else if (image?.error) {
          next[key] = { state: 'error', message: image.error };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectedPart]);

  // ── 장면 이미지 1장 생성 요청 (파이프라인 루프 / 개별 재생성 둘 다 이걸 씀) ──
  // 서버가 요청을 받았다는 것만 확인하고 바로 끝난다 — 실제 생성·저장은 서버가
  // 백그라운드로 이어서 하고, 완료되면 Firestore를 거쳐 novel prop으로 들어온다
  // (아래 useEffect가 그 시점을 감지해 상태를 'done'/'error'로 바꾼다).
  const generateSceneForSlot = async (
    dqId: string,
    dqIndex: number,
    slot: SceneSlot,
    text: string
  ): Promise<void> => {
    const key = `${dqId}:${slot}`;
    setItemStatus((prev) => ({
      ...prev,
      [key]: {
        state: 'running',
        message: '장면 생성 중… (백그라운드에서 계속돼요)',
      },
    }));
    try {
      const mentioned = novel.characters.filter((c) =>
        extractCharNames(text).some(
          (m) => m.toLowerCase() === c.name.toLowerCase()
        )
      );
      // 저장된 이미지 주소가 있으면 주소만 보내고(서버가 직접 내려받음), 아직 저장
      // 전인 이미지는 base64로 보낸다.
      const resolvedChars = mentioned.map((c) =>
        c.imageUrl
          ? { name: c.name, textPrompt: c.textPrompt, imageUrl: c.imageUrl }
          : {
              name: c.name,
              textPrompt: c.textPrompt,
              imageBase64: c.imageBase64,
              imageMime: c.imageMime,
            }
      );

      const res = await fetch('/api/generate-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          novelId: novel.id,
          partId: selectedPartId,
          dqId,
          dqIndex,
          slot,
          styleRefImages: novel.styleRefImages,
          stylePrompt: novel.stylePrompt,
          compositionPrompt: text,
          characters: resolvedChars,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
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
          promptedCharacterNames: getPromptedCharacterNames(novel.characters),
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
          item.dqId,
          item.dqIndex,
          item.slot,
          item.text
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

  const handleRegenerateSlot = (
    dq: DiscussionQuestion,
    dqIndex: number,
    slot: SceneSlot
  ) => {
    if (!selectedPart) return;
    const split = splitCompositionScenes(dq.compositionPrompt);
    const text =
      slot === 'main'
        ? split.main
        : slot === 'optionA'
          ? split.optionA
          : split.optionB;
    if (!text) return;
    generateSceneForSlot(dq.id, dqIndex, slot, text);
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
            <div style={{ marginTop: dqTemplateMissing.length > 0 ? 10 : 0 }}>
              <TemplateFallbackNotice
                templateName="DQ"
                missing={dqTemplateMissing}
              />
              <TemplateFallbackNotice
                templateName="구도 프롬프트"
                missing={compositionTemplateMissing}
              />
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

          <StyleReferenceCallout key={novel.id} novel={novel} />

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
                  onRegenerate={(slot) => handleRegenerateSlot(dq, i, slot)}
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
}: {
  index: number;
  dq: DiscussionQuestion;
  itemStatus: Record<string, AutoGenCharStatus>;
  onRegenerate: (slot: SceneSlot) => void;
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
}: {
  slot: SceneSlot;
  text: string;
  image?: SceneImage;
  status?: AutoGenCharStatus;
  onRegenerate: () => void;
}) {
  const running = status?.state === 'running';
  const imgSrc = image?.url;
  const failed = status?.state === 'error' || Boolean(image?.error);

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
          {/* biome-ignore lint/performance/noImgElement: dynamic Blob URL, not eligible for next/image optimization */}
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
            {/* Blob 주소는 다른 도메인이라 download 속성이 안 먹을 수 있어 새
                탭으로 열어서 직접 저장하게 한다. */}
            <a
              href={imgSrc}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...iconBtnStyle, textDecoration: 'none' }}
              aria-label="원본 이미지 새 탭에서 열기"
            >
              <Download size={11} />
            </a>
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
            background: failed ? '#fff5f5' : 'var(--cream)',
            color: failed ? 'var(--crimson)' : 'var(--ink-soft)',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          {failed ? '실패 — 재시도' : '이미지 생성'}
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
