'use client';
import { Check } from 'lucide-react';
import { useState } from 'react';
import {
  type CharacterTableRow,
  characterNameKey,
  findMatchingCharacters,
  parseCharacterTable,
} from '@/lib/character-table';
import { useStore } from '@/lib/store';
import type { Novel } from '@/types';
import { saveLabelStyle } from './shared';

const linkButtonStyle = {
  padding: 0,
  border: 'none',
  background: 'none',
  fontSize: 10,
  color: 'var(--ink-soft)',
  textDecoration: 'underline',
  cursor: 'pointer',
} as const;

// ⓪-0 표로 캐릭터 등록·정보 일괄 저장. 표의 각 행을 이름으로 등록된 캐릭터에
// 연결해 정보를 저장하고, 연결되는 캐릭터가 없는 행은 새 캐릭터로 등록한다.
// 체크된 행만 한 번에 저장한다.
export default function SaveCharInfoTableBox({ novel }: { novel: Novel }) {
  const { updateNovel } = useStore();
  const [value, setValue] = useState('');
  // 행 위치 → 사용자가 직접 바꾼 체크 상태. 없는 행은 기본값을 따른다.
  const [checkOverrides, setCheckOverrides] = useState<Record<number, boolean>>(
    {}
  );
  // 행 위치 → 이름이 일부만 겹쳐 기존 캐릭터에 연결된 행을 새 캐릭터로 등록하기로 바꿨는지.
  const [registerAsNew, setRegisterAsNew] = useState<Record<number, boolean>>(
    {}
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const rows = parseCharacterTable(value);
  const previews = rows.map((row, index) => {
    const { characters: matched, sameName } = findMatchingCharacters(
      row.name,
      novel.characters
    );
    // 이름이 같은 캐릭터가 있는데 새로 등록하면 이름이 중복되므로, 그 경우는
    // 새 캐릭터로 바꿀 수 없다.
    const isNew =
      matched.length === 0 || (!sameName && registerAsNew[index] === true);
    const overwritten = isNew ? [] : matched.filter((c) => c.info.trim());
    // 이미 정보가 있는 캐릭터를 덮어쓰는 행만 사용자가 직접 체크해야 저장된다.
    const defaultChecked = overwritten.length === 0;
    return {
      index,
      row,
      matched,
      sameName,
      isNew,
      overwritten,
      checked: checkOverrides[index] ?? defaultChecked,
    };
  });

  const infoByCharId = new Map<string, string>();
  const newRowsByName = new Map<string, CharacterTableRow>();
  const conflictNames = new Set<string>();
  for (const p of previews) {
    if (!p.checked) continue;
    if (p.isNew) {
      const key = characterNameKey(p.row.name);
      if (newRowsByName.has(key)) conflictNames.add(p.row.name);
      else newRowsByName.set(key, p.row);
      continue;
    }
    for (const c of p.matched) {
      if (infoByCharId.has(c.id)) conflictNames.add(c.name);
      infoByCharId.set(c.id, p.row.info);
    }
  }
  const updateCount = infoByCharId.size;
  const newCount = newRowsByName.size;
  const overwriteCount = novel.characters.filter(
    (c) => infoByCharId.has(c.id) && c.info.trim()
  ).length;

  const changeRegisterAsNew = (index: number, next: boolean) => {
    setRegisterAsNew((prev) => ({ ...prev, [index]: next }));
    // 등록 방식이 바뀌면 그 행의 체크 기본값도 달라지므로 직접 바꾼 체크는 되돌린다.
    setCheckOverrides((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([key]) => Number(key) !== index)
      )
    );
  };

  const handleSave = async () => {
    setError('');
    try {
      const createdAt = new Date().toISOString();
      await updateNovel(novel.id, {
        characters: [
          ...novel.characters.map((c) => {
            const info = infoByCharId.get(c.id);
            return info === undefined ? c : { ...c, info };
          }),
          ...[...newRowsByName.values()].map((row) => ({
            id: crypto.randomUUID(),
            name: row.name,
            info: row.info,
            textPrompt: '',
            createdAt,
          })),
        ],
      });
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setValue('');
        setCheckOverrides({});
        setRegisterAsNew({});
      }, 1500);
    } catch (e) {
      setError(String(e));
    }
  };

  const summary = [
    `표에서 ${previews.length}개 행을 읽었어요`,
    updateCount > 0 &&
      `기존 캐릭터 ${updateCount}명에게 정보 저장${overwriteCount > 0 ? ` (이미 있던 정보를 덮어쓰는 ${overwriteCount}명 포함)` : ''}`,
    newCount > 0 && `새 캐릭터 ${newCount}명 등록`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div style={{ marginTop: 20, padding: 16, background: 'var(--parchment)' }}>
      <div style={saveLabelStyle}>표로 캐릭터 등록 + 정보 일괄 저장</div>
      <p
        style={{
          fontSize: 11,
          color: 'var(--ink-soft)',
          margin: '0 0 10px',
          lineHeight: 1.6,
        }}
      >
        Word 표를 복사해서 붙여넣으면, 첫 칸의 이름으로 등록된 캐릭터를 찾아
        나머지 칸을 캐릭터 정보로 저장해요. 등록되지 않은 이름은 새 캐릭터로
        등록해요. 열 제목 행이 있으면 각 칸 앞에 제목이 붙어요.
      </p>
      <textarea
        className="input-field"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setCheckOverrides({});
          setRegisterAsNew({});
        }}
        placeholder={
          'Word 표를 복사해서 붙여넣기\n(첫 칸: 캐릭터 이름 / 나머지 칸: 정보)'
        }
        style={{ fontSize: 12, minHeight: 100, marginBottom: 10 }}
      />

      {value.trim() && rows.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--crimson)', lineHeight: 1.6 }}>
          표로 읽지 못했어요. Word에서 표를 그대로 복사해서 붙여넣어 주세요
          (칸이 탭으로 구분돼 있어야 해요).
        </div>
      )}

      {previews.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 11,
              color: 'var(--ink-soft)',
              marginBottom: 8,
              lineHeight: 1.6,
            }}
          >
            {summary}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {previews.map((p) => (
              <label
                key={p.index}
                style={{
                  display: 'flex',
                  gap: 10,
                  padding: '10px 12px',
                  background: 'white',
                  opacity: p.checked ? 1 : 0.6,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={p.checked}
                  onChange={() =>
                    setCheckOverrides((prev) => ({
                      ...prev,
                      [p.index]: !p.checked,
                    }))
                  }
                  style={{ marginTop: 2, flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '2px 8px',
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600 }}>
                      {p.row.name}
                    </span>
                    {p.isNew ? (
                      <span style={{ fontSize: 11, color: 'var(--gold-dim)' }}>
                        → 새 캐릭터로 등록
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--sage)' }}>
                        → {p.matched.map((c) => c.name).join(', ')}
                      </span>
                    )}
                    {p.overwritten.length > 0 && (
                      <span style={{ fontSize: 10, color: 'var(--gold-dim)' }}>
                        이미 정보가 있어요 — 체크하면 덮어써요
                      </span>
                    )}
                    {p.matched.length > 0 && !p.sameName && (
                      <button
                        type="button"
                        onClick={() => changeRegisterAsNew(p.index, !p.isNew)}
                        style={linkButtonStyle}
                      >
                        {p.isNew
                          ? `기존 캐릭터(${p.matched.map((c) => c.name).join(', ')})에 맞추기`
                          : '새 캐릭터로 등록'}
                      </button>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      lineHeight: 1.6,
                      color: 'var(--ink-soft)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {p.row.info}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {conflictNames.size > 0 && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--crimson)',
            marginBottom: 10,
            lineHeight: 1.6,
          }}
        >
          같은 캐릭터({[...conflictNames].join(', ')})를 가리키는 체크된 행이
          여러 개예요. 한 캐릭터에는 행 하나만 체크해주세요.
        </div>
      )}
      {error && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--crimson)',
            marginBottom: 10,
            lineHeight: 1.6,
          }}
        >
          {error}
        </div>
      )}

      {previews.length > 0 && (
        <button
          type="button"
          className="btn-primary"
          onClick={handleSave}
          disabled={
            updateCount + newCount === 0 || conflictNames.size > 0 || saved
          }
          style={{
            fontSize: 12,
            padding: '7px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {saved ? (
            <>
              <Check size={12} /> Saved!
            </>
          ) : (
            `${updateCount + newCount}명 저장`
          )}
        </button>
      )}
    </div>
  );
}
