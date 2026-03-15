'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import Sidebar from '@/components/Sidebar';
import SetupPanel from '@/components/SetupPanel';
import WorkPanel from '@/components/WorkPanel';
import HistoryPanel from '@/components/HistoryPanel';
import SettingsModal from '@/components/SettingsModal';
import { Settings } from 'lucide-react';

type Tab = 'work' | 'history';

export default function Home() {
  const { activeNovelId, novels } = useStore();
  const [tab, setTab] = useState<Tab>('work');
  const [showSettings, setShowSettings] = useState(false);

  const novel = novels.find((n) => n.id === activeNovelId);
  const isSetup = novel && novel.parts.length === 0;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <header style={{
          height: 52, borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px', background: 'white', flexShrink: 0,
        }}>
          <div style={{ display: 'flex' }}>
            {!isSetup && (['work', 'history'] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                height: 52, padding: '0 18px', fontSize: 12, fontWeight: 500,
                letterSpacing: '0.07em', textTransform: 'uppercase',
                color: tab === t ? 'var(--ink)' : 'var(--ink-soft)',
                borderBottom: tab === t ? '2px solid var(--gold)' : '2px solid transparent',
                transition: 'all 0.2s',
              }}>
                {t === 'work' ? 'Scene Studio' : 'Archive'}
              </button>
            ))}
          </div>

          <button onClick={() => setShowSettings(true)} style={{
            background: 'none', border: '1px solid var(--border)', cursor: 'pointer',
            padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: 'var(--ink-soft)', transition: 'all 0.2s',
          }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--gold)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <Settings size={13} /> Settings
          </button>
        </header>

        <main style={{ flex: 1, overflow: 'auto', padding: 28 }}>
          {!novel ? (
            <EmptyState />
          ) : isSetup ? (
            <SetupPanel novel={novel} />
          ) : tab === 'work' ? (
            <WorkPanel novel={novel} />
          ) : (
            <HistoryPanel />
          )}
        </main>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 10, opacity: 0.45, textAlign: 'center' }}>
      <div style={{ fontSize: 48 }}>📚</div>
      <p className="serif" style={{ fontSize: 22, fontWeight: 300, margin: 0 }}>Add a novel to get started</p>
      <p style={{ fontSize: 13, margin: 0 }}>Use the sidebar to create your first novel project</p>
    </div>
  );
}
