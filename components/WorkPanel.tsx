'use client';
import { Download, RefreshCw, Sparkles, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  buildSceneWorkItems,
  isAutoRunInProgress,
  isAutoRunStalled,
} from '@/lib/auto-run';
import { splitCompositionScenes } from '@/lib/output-format';
import { pickMentionedCharacters, resolvePromptTemplate } from '@/lib/prompts';
import type { SceneCharacterInput } from '@/lib/scene-generation';
import { useStore } from '@/lib/store';
import type {
  AutoRun,
  AutoRunMode,
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
  TemplateFallbackNotice,
} from './ManualPanel/shared';
import { StyleReferenceCallout } from './StyleReferencePanel';

interface Props {
  novel: Novel;
}

const DQ_ROW_ID = 'dq-generation';

// 서버가 진행 중이거나 끊겼는지 다시 판단하는 주기.
const NOW_TICK_MS = 15 * 1000;

const SLOT_LABELS: Record<SceneSlot, string> = {
  main: '본문',
  optionA: 'Option A',
  optionB: 'Option B',
};

function slotKey(dqId: string, slot: SceneSlot): string {
  return `${dqId}:${slot}`;
}

// 저장된 이미지 주소가 있으면 주소만 보내고(서버가 직접 내려받음), 아직 저장
// 전인 이미지는 base64로 보낸다.
function toSceneCharacterInput(c: Character): SceneCharacterInput {
  return c.imageUrl
    ? { name: c.name, textPrompt: c.textPrompt, imageUrl: c.imageUrl }
    : {
        name: c.name,
        textPrompt: c.textPrompt,
        imageBase64: c.imageBase64,
        imageMime: c.imageMime,
      };
}

// 서버가 기록한 실행 상태를 시간 흐름에 맞춰 다시 판단하기 위한 현재 시각.
// active일 때만 주기적으로 갱신한다.
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), NOW_TICK_MS);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

function questionStageStatus(
  run: AutoRun,
  stalled: boolean
): AutoGenCharStatus {
  if (stalled)
    return {
      state: 'error',
      message: '서버가 중간에 멈춘 것 같아요 — 전체 다시 생성을 눌러주세요',
    };
  if (run.status === 'running')
    return {
      state: 'running',
      message: 'DQ+구도 생성 중… (백그라운드에서 계속돼요)',
    };
  if (run.status === 'stopped') return { state: 'error', message: '중지됨' };
  return { state: 'error', message: run.error ?? '생성하지 못했어요' };
}

function sceneStageStatus(
  run: AutoRun,
  stalled: boolean,
  image: SceneImage | undefined
): AutoGenCharStatus {
  if (image?.url) return { state: 'done', message: '완료 — 자동 저장됨' };
  if (image?.error) return { state: 'error', message: image.error };
  if (stalled)
    return {
      state: 'error',
      message: '서버가 중간에 멈췄어요 — 이어서 생성을 눌러주세요',
    };
  if (run.status === 'running')
    return {
      state: 'running',
      message: '장면 생성 중… (백그라운드에서 계속돼요)',
    };
  if (run.status === 'stopped') return { state: 'error', message: '중지됨' };
  return { state: 'error', message: '만들어지지 않았어요' };
}

// 서버가 저장한 실행 기록과 장면 결과만으로 진행 목록을 만든다. 브라우저 안에
// 진행 상태를 따로 들고 있지 않으므로 새로고침·재접속 뒤에도 같은 진행이 보인다.
function describePipeline(
  part: NovelPart,
  run: AutoRun,
  now: number
): {
  rows: { id: string; name: string }[];
  status: Record<string, AutoGenCharStatus>;
} {
  const stalled = isAutoRunStalled(run, now);
  const rows = [{ id: DQ_ROW_ID, name: '① DQ + 구도 프롬프트' }];
  const status: Record<string, AutoGenCharStatus> = {};

  if (run.stage === 'questions') {
    status[DQ_ROW_ID] = questionStageStatus(run, stalled);
    return { rows, status };
  }

  status[DQ_ROW_ID] = {
    state: 'done',
    message: `DQ ${part.discussionQuestions.length}개 준비됨`,
  };
  for (const item of buildSceneWorkItems(part.discussionQuestions)) {
    const key = slotKey(item.dqId, item.slot);
    rows.push({
      id: key,
      name: `Q${item.dqIndex + 1} · ${SLOT_LABELS[item.slot]}`,
    });
    status[key] = sceneStageStatus(
      run,
      stalled,
      part.discussionQuestions[item.dqIndex].sceneImages?.[item.slot]
    );
  }
  return { rows, status };
}

export default function WorkPanel({ novel }: Props) {
  const { promptTemplates, stopAutoRun } = useStore();
  const [selectedPartId, setSelectedPartId] = useState<string>(
    novel.parts[0]?.id ?? ''
  );
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [requestError, setRequestError] = useState('');
  // 개별 장면 재생성 요청의 진행 상태. 전체 자동 생성의 진행은 서버가 저장한 실행
  // 기록에서 읽는다.
  const [itemStatus, setItemStatus] = useState<
    Record<string, AutoGenCharStatus>
  >({});

  const selectedPart = novel.parts.find((p) => p.id === selectedPartId);
  const autoRun = selectedPart?.autoRun;
  const now = useNow(autoRun?.status === 'running');
  const running = isAutoRunInProgress(autoRun, now);
  const busy = starting || running;

  const dqTemplateMissing = resolvePromptTemplate(
    'dq',
    promptTemplates.dq
  ).missing;
  const compositionTemplateMissing = resolvePromptTemplate(
    'composition',
    promptTemplates.composition
  ).missing;

  const pipeline =
    selectedPart && autoRun && autoRun.status !== 'done'
      ? describePipeline(selectedPart, autoRun, now)
      : null;
  // 실행 중인 동안에는 카드의 장면들도 서버 진행 상태를 따른다.
  const slotStatus: Record<string, AutoGenCharStatus> = {
    ...(autoRun?.status === 'running' ? pipeline?.status : undefined),
    ...itemStatus,
  };
  const missingImageCount = selectedPart
    ? buildSceneWorkItems(selectedPart.discussionQuestions).filter(
        (item) =>
          !selectedPart.discussionQuestions[item.dqIndex].sceneImages?.[
            item.slot
          ]?.url
      ).length
    : 0;
  const errorMessage =
    requestError || (autoRun?.status === 'error' ? autoRun.error : '');

  const selectPart = (partId: string) => {
    setSelectedPartId(partId);
    setItemStatus({});
    setRequestError('');
  };

  // 개별 재생성이 끝나면 Firestore 실시간 구독을 거쳐 novel prop이 갱신된다.
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

  // ── 장면 이미지 1장 개별 재생성 요청 ──
  // 서버가 요청을 받았다는 것만 확인하고 바로 끝난다 — 실제 생성·저장은 서버가
  // 백그라운드로 이어서 하고, 완료되면 Firestore를 거쳐 novel prop으로 들어온다
  // (위 useEffect가 그 시점을 감지해 상태를 'done'/'error'로 바꾼다).
  const generateSceneForSlot = async (
    dqId: string,
    dqIndex: number,
    slot: SceneSlot,
    text: string
  ): Promise<void> => {
    const key = slotKey(dqId, slot);
    setItemStatus((prev) => ({
      ...prev,
      [key]: {
        state: 'running',
        message: '장면 생성 중… (백그라운드에서 계속돼요)',
      },
    }));
    try {
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
          characters: pickMentionedCharacters(text, novel.characters).map(
            toSceneCharacterInput
          ),
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

  // ── ①DQ+구도 생성 → ④장면 이미지(DQ당 3장)를 서버가 끝까지 이어서 진행 ──
  // 요청은 서버가 접수했다는 응답까지만 기다린다. 이후 진행은 브라우저 탭과
  // 무관하게 서버가 계속하고, 이 화면은 저장된 실행 기록을 구독해서 보여준다.
  const startAutoRun = async (mode: AutoRunMode) => {
    if (!selectedPart) return;
    setStarting(true);
    setRequestError('');
    setItemStatus({});
    try {
      const res = await fetch('/api/auto-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          novelId: novel.id,
          partId: selectedPart.id,
          novelTitle: novel.title,
          partContent: selectedPart.content,
          characters: novel.characters.map(toSceneCharacterInput),
          dqTemplate: promptTemplates.dq,
          compositionTemplate: promptTemplates.composition,
          styleRefImages: novel.styleRefImages,
          stylePrompt: novel.stylePrompt,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.accepted) {
        throw new Error(
          data?.error ??
            (res.status === 413
              ? '보내는 이미지가 너무 커요 — 스타일 참고 이미지를 줄이거나 몇 장 빼주세요'
              : `요청이 거절됐어요 (HTTP ${res.status})`)
        );
      }
    } catch (e) {
      setRequestError(String(e));
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    if (!selectedPart) return;
    setStopping(true);
    try {
      await stopAutoRun(novel.id, selectedPart.id);
    } catch (e) {
      setRequestError(String(e));
    } finally {
      setStopping(false);
    }
  };

  const handleRegenerateSlot = (
    dq: DiscussionQuestion,
    dqIndex: number,
    slot: SceneSlot
  ) => {
    if (!selectedPart || busy) return;
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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-gold"
                onClick={() => startAutoRun('full')}
                disabled={busy || !selectedPart.content}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  padding: '9px 18px',
                }}
              >
                {busy ? (
                  <RefreshCw
                    size={12}
                    style={{ animation: 'spin 1s linear infinite' }}
                  />
                ) : (
                  <Sparkles size={12} />
                )}
                {busy
                  ? '생성 중…'
                  : selectedPart.discussionQuestions.length > 0
                    ? '전체 다시 생성'
                    : '전체 자동 생성'}
              </button>
              {!busy && missingImageCount > 0 && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => startAutoRun('images-only')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    padding: '9px 18px',
                  }}
                >
                  <Sparkles size={12} /> 빠진 이미지 이어서 생성 (
                  {missingImageCount}장)
                </button>
              )}
              {running && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={handleStop}
                  disabled={stopping}
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
            {running && (
              <p
                style={{
                  fontSize: 11,
                  color: 'var(--ink-soft)',
                  margin: '10px 0 0',
                }}
              >
                서버에서 진행 중이에요. 이 화면을 닫거나 새로고침해도 계속돼요.
                스타일 프롬프트와 참고 이미지는 시작할 때의 내용으로 진행돼요.
              </p>
            )}
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
            {errorMessage && (
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
                {errorMessage}
              </div>
            )}
            {pipeline && (
              <AutoGenStatusList
                chars={pipeline.rows}
                status={pipeline.status}
              />
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
                  slotStatus={slotStatus}
                  regenerateDisabled={busy}
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
  slotStatus,
  regenerateDisabled,
  onRegenerate,
}: {
  index: number;
  dq: DiscussionQuestion;
  slotStatus: Record<string, AutoGenCharStatus>;
  regenerateDisabled: boolean;
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
              status={slotStatus[slotKey(dq.id, slot)]}
              regenerateDisabled={regenerateDisabled}
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
  regenerateDisabled,
  onRegenerate,
}: {
  slot: SceneSlot;
  text: string;
  image?: SceneImage;
  status?: AutoGenCharStatus;
  regenerateDisabled: boolean;
  onRegenerate: () => void;
}) {
  const running = status?.state === 'running';
  const imgSrc = image?.url;
  const failed = status?.state === 'error' || Boolean(image?.error);
  const disabledStyle = regenerateDisabled
    ? { opacity: 0.5, cursor: 'not-allowed' }
    : undefined;

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
              disabled={regenerateDisabled}
              style={{ ...iconBtnStyle, ...disabledStyle }}
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
          disabled={regenerateDisabled}
          style={{
            width: '100%',
            aspectRatio: '16/9',
            border: '1px dashed var(--border)',
            background: failed ? '#fff5f5' : 'var(--cream)',
            color: failed ? 'var(--crimson)' : 'var(--ink-soft)',
            fontSize: 11,
            cursor: 'pointer',
            ...disabledStyle,
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
