import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Novel, Character, DiscussionQuestion, HistoryEntry } from '@/types';
import {
  saveNovel, updateNovelField, deleteNovel as fbDeleteNovel,
  subscribeNovels, saveCharacterImage, saveSceneImage,
} from './firestore';

interface AppStore {
  // Settings
  apiKey: string;
  setApiKey: (key: string) => void;

  // Novels
  novels: Novel[];
  activeNovelId: string | null;
  setActiveNovel: (id: string) => void;
  setNovels: (novels: Novel[]) => void;
  addNovel: (novel: Novel) => Promise<void>;
  updateNovel: (id: string, data: Partial<Novel>) => Promise<void>;
  deleteNovel: (id: string) => Promise<void>;

  // Characters
  updateCharacter: (novelId: string, charId: string, data: Partial<Character>) => Promise<void>;
  saveCharImage: (novelId: string, charId: string, base64: string, mime: string) => Promise<string>;

  // Parts / DQ
  updateDQ: (novelId: string, partId: string, dqId: string, data: Partial<DiscussionQuestion>) => Promise<void>;
  saveScene: (novelId: string, partId: string, dqId: string, base64: string, mime: string) => Promise<string>;

  // History (local only — images stored in Firebase)
  history: HistoryEntry[];
  addHistory: (entry: Omit<HistoryEntry, 'id' | 'createdAt'>) => void;
  clearHistory: () => void;

  // Firebase subscription
  unsubscribe: (() => void) | null;
  startSync: () => void;
  stopSync: () => void;
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      apiKey: '',
      setApiKey: (key) => set({ apiKey: key }),

      novels: [],
      activeNovelId: null,
      unsubscribe: null,

      setNovels: (novels) => set({ novels }),
      setActiveNovel: (id) => set({ activeNovelId: id }),

      addNovel: async (novel) => {
        await saveNovel(novel);
        set((s) => ({ novels: [novel, ...s.novels], activeNovelId: novel.id }));
      },

      updateNovel: async (id, data) => {
        set((s) => ({
          novels: s.novels.map((n) => (n.id === id ? { ...n, ...data } : n)),
        }));
        const updated = get().novels.find((n) => n.id === id);
        if (updated) await saveNovel({ ...updated, ...data });
      },

      deleteNovel: async (id) => {
        await fbDeleteNovel(id);
        set((s) => ({
          novels: s.novels.filter((n) => n.id !== id),
          activeNovelId: s.activeNovelId === id ? (s.novels.find(n => n.id !== id)?.id ?? null) : s.activeNovelId,
        }));
      },

      updateCharacter: async (novelId, charId, data) => {
        set((s) => ({
          novels: s.novels.map((n) =>
            n.id !== novelId ? n : {
              ...n,
              characters: n.characters.map((c) => (c.id === charId ? { ...c, ...data } : c)),
            }
          ),
        }));
        const novel = get().novels.find((n) => n.id === novelId);
        if (novel) await saveNovel(novel);
      },

      saveCharImage: async (novelId, charId, base64, mime) => {
        const novel = get().novels.find((n) => n.id === novelId);
        if (!novel) return '';
        const url = await saveCharacterImage(novel, charId, base64, mime);
        // Update local state with URL
        set((s) => ({
          novels: s.novels.map((n) =>
            n.id !== novelId ? n : {
              ...n,
              characters: n.characters.map((c) =>
                c.id === charId ? { ...c, imageUrl: url, imageBase64: base64, imageMime: mime } : c
              ),
            }
          ),
        }));
        return url;
      },

      updateDQ: async (novelId, partId, dqId, data) => {
        set((s) => ({
          novels: s.novels.map((n) =>
            n.id !== novelId ? n : {
              ...n,
              parts: n.parts.map((p) =>
                p.id !== partId ? p : {
                  ...p,
                  discussionQuestions: p.discussionQuestions.map((dq) =>
                    dq.id === dqId ? { ...dq, ...data } : dq
                  ),
                }
              ),
            }
          ),
        }));
        const novel = get().novels.find((n) => n.id === novelId);
        if (novel) await saveNovel(novel);
      },

      saveScene: async (novelId, partId, dqId, base64, mime) => {
        const novel = get().novels.find((n) => n.id === novelId);
        if (!novel) return '';
        const url = await saveSceneImage(novel, partId, dqId, base64, mime);
        set((s) => ({
          novels: s.novels.map((n) =>
            n.id !== novelId ? n : {
              ...n,
              parts: n.parts.map((p) =>
                p.id !== partId ? p : {
                  ...p,
                  discussionQuestions: p.discussionQuestions.map((dq) =>
                    dq.id === dqId ? { ...dq, sceneImageUrl: url, sceneImage: base64, sceneMime: mime } : dq
                  ),
                }
              ),
            }
          ),
        }));
        return url;
      },

      history: [],
      addHistory: (entry) =>
        set((s) => ({
          history: [
            { ...entry, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
            ...s.history,
          ].slice(0, 200),
        })),
      clearHistory: () => set({ history: [] }),

      startSync: () => {
        const { unsubscribe: existing } = get();
        if (existing) existing();
        const unsub = subscribeNovels((novels) => {
          set({ novels });
        });
        set({ unsubscribe: unsub });
      },

      stopSync: () => {
        const { unsubscribe } = get();
        if (unsubscribe) { unsubscribe(); set({ unsubscribe: null }); }
      },
    }),
    {
      name: 'novel-studio-v2',
      partialize: (state) => ({
        apiKey: state.apiKey,
        activeNovelId: state.activeNovelId,
        history: state.history.map((h) => ({ ...h, imageBase64: undefined })),
        // novels come from Firebase, not localStorage
      }),
    }
  )
);
