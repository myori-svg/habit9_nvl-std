'use client';
import { Trash2 } from 'lucide-react';
import { useStore } from '@/lib/store';

export default function HistoryPanel() {
  const { history, clearHistory } = useStore();

  if (!history.length) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '60vh',
          opacity: 0.4,
        }}
      >
        <p className="serif" style={{ fontSize: 18, fontWeight: 300 }}>
          No archive yet
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <h2
          className="serif"
          style={{ fontSize: 24, fontWeight: 300, margin: 0 }}
        >
          Archive
        </h2>
        <button
          type="button"
          className="btn-ghost"
          onClick={clearHistory}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
          }}
        >
          <Trash2 size={12} /> Clear All
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {history.map((entry) => (
          <div key={entry.id} className="card" style={{ overflow: 'hidden' }}>
            {entry.imageBase64 && (
              // biome-ignore lint/performance/noImgElement: dynamic base64 data URI, not eligible for next/image optimization
              <img
                src={`data:${entry.imageMime || 'image/png'};base64,${entry.imageBase64}`}
                alt={entry.label}
                style={{
                  width: '100%',
                  aspectRatio: '16/9',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            )}
            <div style={{ padding: '12px 14px' }}>
              <p
                style={{
                  fontSize: 11,
                  color: 'var(--gold-dim)',
                  margin: '0 0 4px',
                  fontStyle: 'italic',
                }}
              >
                {entry.novelTitle}
              </p>
              <p style={{ fontSize: 12, margin: '0 0 6px', lineHeight: 1.4 }}>
                {entry.label}
              </p>
              <p
                style={{
                  fontSize: 10,
                  color: 'var(--ink-soft)',
                  margin: 0,
                  opacity: 0.5,
                }}
              >
                {new Date(entry.createdAt).toLocaleString('ko-KR')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
