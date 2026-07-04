'use client';
import { X } from 'lucide-react';

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss overlay, not a keyboard-operable widget
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss overlay, not a keyboard-operable widget
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(26,20,16,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        backdropFilter: 'blur(2px)',
      }}
    >
      <div className="card fade-up" style={{ width: 460, padding: 28 }}>
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
            style={{ fontSize: 20, fontWeight: 400, margin: 0 }}
          >
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--ink-soft)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            padding: '12px 14px',
            background: 'rgba(201,168,76,0.08)',
            border: '1px solid rgba(201,168,76,0.3)',
            fontSize: 12,
            lineHeight: 1.6,
            color: 'var(--ink-soft)',
            marginBottom: 20,
          }}
        >
          <strong>Models:</strong>
          <br />• Text: <code>gemini-2.5-flash</code>
          <br />• Image: <code>gemini-2.5-flash-image</code>
          <br />
          <strong>Est. cost:</strong> ~$8–10/month for ~60 scene images
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-primary" onClick={onClose} type="button">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
