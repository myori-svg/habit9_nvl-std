'use client';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { buildCharPromptPrompt } from '@/lib/prompts';
import { useStore } from '@/lib/store';
import type { Novel } from '@/types';
import {
  type AutoGenCharStatus,
  AutoGenStatusList,
  PromptBox,
  SaveCharPromptBox,
} from './shared';

interface Props {
  novel: Novel;
  charPromptName: string;
  setCharPromptName: React.Dispatch<React.SetStateAction<string>>;
  charPromptInfo: string;
  setCharPromptInfo: React.Dispatch<React.SetStateAction<string>>;
}

export default function CharPromptStep({
  novel,
  charPromptName,
  setCharPromptName,
  charPromptInfo,
  setCharPromptInfo,
}: Props) {
  const { updateCharacter } = useStore();
  const [autoRunning, setAutoRunning] = useState(false);
  const [charStatus, setCharStatus] = useState<
    Record<string, AutoGenCharStatus>
  >({});

  const charPromptPrompt = buildCharPromptPrompt(
    charPromptName,
    charPromptInfo
  );

  const pendingChars = novel.characters.filter((c) => !c.textPrompt);

  const handleAutoGenerate = async () => {
    setAutoRunning(true);
    setCharStatus(
      Object.fromEntries(pendingChars.map((c) => [c.id, { state: 'pending' }]))
    );

    for (const char of pendingChars) {
      try {
        let info = char.info;
        if (!info) {
          setCharStatus((prev) => ({
            ...prev,
            [char.id]: { state: 'running', message: '정보 생성 중…' },
          }));
          const infoRes = await fetch('/api/generate-character-info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              novelTitle: novel.title,
              characterName: char.name,
              summary: novel.summary,
            }),
          });
          const infoData = await infoRes.json();
          if (infoData.error) throw new Error(infoData.error);
          info = infoData.info;
          await updateCharacter(novel.id, char.id, { info });
        }

        setCharStatus((prev) => ({
          ...prev,
          [char.id]: { state: 'running', message: '프롬프트 생성 중…' },
        }));
        const promptRes = await fetch('/api/generate-character-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            characterName: char.name,
            characterInfo: info,
          }),
        });
        const promptData = await promptRes.json();
        if (promptData.error) throw new Error(promptData.error);
        await updateCharacter(novel.id, char.id, {
          textPrompt: promptData.textPrompt,
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
    }

    setAutoRunning(false);
  };

  return (
    <div>
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
                : '정보+프롬프트 자동 생성'}
          </button>
          <AutoGenStatusList chars={pendingChars} status={charStatus} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {novel.characters.length > 0 ? (
          <select
            value={charPromptName}
            onChange={(e) => {
              setCharPromptName(e.target.value);
              const c = novel.characters.find(
                (ch) => ch.name === e.target.value
              );
              setCharPromptInfo(c?.info ?? '');
            }}
            className="input-field"
            style={{ fontSize: 12, flex: 1 }}
          >
            {novel.characters.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="input-field"
            value={charPromptName}
            onChange={(e) => setCharPromptName(e.target.value)}
            placeholder="캐릭터 이름"
            style={{ fontSize: 12, flex: 1 }}
          />
        )}
      </div>
      <textarea
        className="input-field"
        value={charPromptInfo}
        onChange={(e) => setCharPromptInfo(e.target.value)}
        placeholder="캐릭터 정보 (③에서 Gemini가 생성한 결과 붙여넣기)"
        style={{ fontSize: 12, minHeight: 80, marginBottom: 12 }}
      />
      <PromptBox prompt={charPromptPrompt} label="Gemini에 붙여넣을 프롬프트" />
      <SaveCharPromptBox novel={novel} charName={charPromptName} />
    </div>
  );
}
