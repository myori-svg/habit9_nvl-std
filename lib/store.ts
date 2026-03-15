import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Novel, Character, NovelPart, DiscussionQuestion, HistoryEntry } from '@/types';

interface AppStore {
  // Settings
  apiKey: string;
  setApiKey: (key: string) => void;

  // Novels
  novels: Novel[];
  activeNovelId: string | null;
  setActiveNovel: (id: string) => void;
  addNovel: (novel: Novel) => void;
  updateNovel: (id: string, data: Partial<Novel>) => void;
  deleteNovel: (id: string) => void;

  // Characters
  updateCharacter: (novelId: string, charId: string, data: Partial<Character>) => void;

  // Parts / DQ
  updateDQ: (novelId: string, partId: string, dqId: string, data: Partial<DiscussionQuestion>) => void;

  // History
  history: HistoryEntry[];
  addHistory: (entry: Omit<HistoryEntry, 'id' | 'createdAt'>) => void;
  clearHistory: () => void;

  // Active work session
  activePartId: string | null;
  activeDQId: string | null;
  setActiveWork: (partId: string | null, dqId: string | null) => void;
}

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      apiKey: '',
      setApiKey: (key) => set({ apiKey: key }),

      novels: [],
      activeNovelId: null,
      setActiveNovel: (id) => set({ activeNovelId: id }),

      addNovel: (novel) =>
        set((s) => ({ novels: [...s.novels, novel], activeNovelId: novel.id })),

      updateNovel: (id, data) =>
        set((s) => ({ novels: s.novels.map((n) => (n.id === id ? { ...n, ...data } : n)) })),

      deleteNovel: (id) =>
        set((s) => ({
          novels: s.novels.filter((n) => n.id !== id),
          activeNovelId: s.activeNovelId === id ? (s.novels[0]?.id ?? null) : s.activeNovelId,
        })),

      updateCharacter: (novelId, charId, data) =>
        set((s) => ({
          novels: s.novels.map((n) =>
            n.id === novelId
              ? { ...n, characters: n.characters.map((c) => (c.id === charId ? { ...c, ...data } : c)) }
              : n
          ),
        })),

      updateDQ: (novelId, partId, dqId, data) =>
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
        })),

      history: [],
      addHistory: (entry) =>
        set((s) => ({
          history: [
            { ...entry, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
            ...s.history,
          ].slice(0, 200),
        })),
      clearHistory: () => set({ history: [] }),

      activePartId: null,
      activeDQId: null,
      setActiveWork: (partId, dqId) => set({ activePartId: partId, activeDQId: dqId }),
    }),
    {
      name: 'novel-studio-v2',
      // Don't persist base64 images in localStorage to avoid quota issues
      // Instead we keep them in memory during session only
      partialize: (state) => ({
        apiKey: state.apiKey,
        activeNovelId: state.activeNovelId,
        novels: state.novels.map((n) => ({
          ...n,
          styleImageBase64: undefined, // too large for localStorage
          characters: n.characters.map((c) => ({ ...c, imageBase64: undefined })),
          parts: n.parts.map((p) => ({
            ...p,
            discussionQuestions: p.discussionQuestions.map((dq) => ({
              ...dq,
              sceneImage: undefined,
            })),
          })),
        })),
        history: state.history.map((h) => ({ ...h, imageBase64: undefined })),
      }),
    }
  )
);
