'use client';
import { ExternalLink, Eye, EyeOff, X } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '@/lib/store';

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { apiKey, setApiKey } = useStore();
  const [key, setKey] = useState(apiKey);
  const [show, setShow] = useState(false);

  return (
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

        <label
          style={{
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--ink-soft)',
            display: 'block',
            marginBottom: 6,
          }}
        >
          Gemini API Key
        </label>
        <div style={{ position: 'relative' }}>
          <input
            className="input-field"
            type={show ? 'text' : 'password'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="AIza..."
            style={{ paddingRight: 40 }}
          />
          <button
            onClick={() => setShow(!show)}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--ink-soft)',
            }}
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <p
          style={{
            fontSize: 11,
            color: 'var(--ink-soft)',
            margin: '6px 0 16px',
            opacity: 0.6,
          }}
        >
          Stored locally in your browser only.{' '}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener"
            style={{
              color: 'var(--gold-dim)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            Get API key <ExternalLink size={10} />
          </a>
        </p>

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
          <br />• Text: <code>gemini-2.5-flash-preview-05-20</code>
          <br />• Image: <code>gemini-2.0-flash-preview-image-generation</code>
          <br />
          <strong>Est. cost:</strong> ~$8–10/month for ~60 scene images
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              setApiKey(key.trim());
              onClose();
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
