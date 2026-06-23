'use client';
import { Settings } from 'lucide-react';
import { useState } from 'react';
import HistoryPanel from '@/components/HistoryPanel';
import ManualPanel from '@/components/ManualPanel/ManualPanel';
import SettingsModal from '@/components/SettingsModal';
import SetupPanel from '@/components/SetupPanel';
import Sidebar from '@/components/Sidebar';
import WorkPanel from '@/components/WorkPanel';
import { useStore } from '@/lib/store';

type Tab = 'work' | 'manual' | 'history';

export default function Home() {
  const { activeNovelId, novels } = useStore();
  const [tab, setTab] = useState<Tab>('manual');
  const [showSettings, setShowSettings] = useState(false);

  const novel = novels.find((n) => n.id === activeNovelId);
  const isSetup = false;

  const TABS: { id: Tab; label: string }[] = [
    { id: 'manual', label: 'Manual Mode' },
    { id: 'work', label: 'Auto Mode' },
    { id: 'history', label: 'Archive' },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <header
          style={{
            height: 52,
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            background: 'white',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex' }}>
            {novel &&
              !isSetup &&
              TABS.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    height: 52,
                    padding: '0 18px',
                    fontSize: 12,
                    fontWeight: 500,
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    color: tab === t.id ? 'var(--ink)' : 'var(--ink-soft)',
                    borderBottom:
                      tab === t.id
                        ? '2px solid var(--gold)'
                        : '2px solid transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  {t.label}
                </button>
              ))}
          </div>

          <button
            type="button"
            onClick={() => setShowSettings(true)}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: 'var(--ink-soft)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor = 'var(--gold)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor = 'var(--border)')
            }
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
          ) : tab === 'manual' ? (
            <ManualPanel novel={novel} />
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        gap: 10,
        opacity: 0.45,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 48 }}>📚</div>
      <p className="serif" style={{ fontSize: 22, fontWeight: 300, margin: 0 }}>
        Add a novel to get started
      </p>
      <p style={{ fontSize: 13, margin: 0 }}>
        Use the sidebar to create your first novel project
      </p>
    </div>
  );
}
