'use client';
import { BookOpen, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '@/lib/store';

interface Props {
  open: boolean;
  onNavigate: () => void;
}

export default function Sidebar({ open, onNavigate }: Props) {
  const { novels, activeNovelId, deleteNovel, setActiveNovel, addNovel } =
    useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');

  const handleAdd = () => {
    if (!title.trim()) return;
    addNovel({
      id: crypto.randomUUID(),
      title: title.trim(),
      summary: '',
      stylePrompt: '',
      characters: [],
      parts: [],
      createdAt: new Date().toISOString(),
    });
    setTitle('');
    setShowAdd(false);
  };

  return (
    <aside
      className={`sidebar${open ? ' open' : ''}`}
      style={{
        borderRight: '1px solid var(--border)',
        background: 'var(--parchment)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '18px 16px 14px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--ink)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h1
            className="serif"
            style={{
              color: 'var(--gold)',
              fontSize: 20,
              fontWeight: 300,
              margin: 0,
              letterSpacing: '0.06em',
            }}
          >
            Novel Studio
          </h1>
          <p
            style={{
              color: 'var(--parchment)',
              fontSize: 10,
              margin: '3px 0 0',
              opacity: 0.5,
              letterSpacing: '0.1em',
            }}
          >
            AI SCENE GENERATOR
          </p>
        </div>
        <button
          type="button"
          className="sidebar-close-btn"
          onClick={onNavigate}
          aria-label="사이드바 닫기"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--parchment)',
            opacity: 0.7,
            padding: 2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 6px 4px',
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: '0.1em',
              color: 'var(--ink-soft)',
              textTransform: 'uppercase',
            }}
          >
            Projects
          </span>
          <button
            type="button"
            onClick={() => setShowAdd(!showAdd)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--gold-dim)',
              padding: 2,
            }}
          >
            <Plus size={14} />
          </button>
        </div>

        {showAdd && (
          <div style={{ padding: '8px 6px', display: 'flex', gap: 6 }}>
            <input
              className="input-field"
              placeholder="Novel title…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              style={{ fontSize: 12, flex: 1 }}
            />
            <button
              type="button"
              className="btn-primary"
              onClick={handleAdd}
              style={{ padding: '6px 10px', fontSize: 12 }}
            >
              Add
            </button>
          </div>
        )}

        {novels.map((novel) => (
          // biome-ignore lint/a11y/useSemanticElements: contains a nested delete <button>, can't be a <button> itself
          <div
            key={novel.id}
            role="button"
            tabIndex={0}
            onClick={() => {
              setActiveNovel(novel.id);
              onNavigate();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                setActiveNovel(novel.id);
                onNavigate();
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              cursor: 'pointer',
              background:
                activeNovelId === novel.id
                  ? 'rgba(201,168,76,0.12)'
                  : 'transparent',
              borderLeft:
                activeNovelId === novel.id
                  ? '2px solid var(--gold)'
                  : '2px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            <BookOpen
              size={13}
              style={{ color: 'var(--gold-dim)', flexShrink: 0 }}
            />
            <span
              style={{
                fontSize: 13,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {novel.title}
            </span>
            <div
              style={{
                display: 'flex',
                gap: 4,
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <span
                style={{ fontSize: 10, color: 'var(--ink-soft)', opacity: 0.5 }}
              >
                {novel.parts.length > 0 ? `${novel.parts.length}pts` : 'setup'}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNovel(novel.id);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--crimson)',
                  opacity: 0.4,
                  padding: 2,
                }}
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        ))}

        {novels.length === 0 && (
          <p
            style={{
              fontSize: 12,
              color: 'var(--ink-soft)',
              opacity: 0.5,
              padding: '8px 10px',
            }}
          >
            No projects yet
          </p>
        )}
      </div>
    </aside>
  );
}
