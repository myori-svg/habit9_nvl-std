import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Character,
  DiscussionQuestion,
  HistoryEntry,
  Novel,
} from '@/types';
import {
  deleteNovel as fbDeleteNovel,
  saveCharacterImage,
  saveNovel,
  saveSceneImage,
  subscribeNovels,
} from './firestore';

interface AppStore {
  apiKey: string;
  setApiKey: (key: string) => void;

  novels: Novel[];
  activeNovelId: string | null;
  setActiveNovel: (id: string) => void;
  addNovel: (novel: Novel) => Promise<void>;
  updateNovel: (id: string, data: Partial<Novel>) => Promise<void>;
  deleteNovel: (id: string) => Promise<void>;

  updateCharacter: (
    novelId: string,
    charId: string,
    data: Partial<Character>
  ) => Promise<void>;
  saveCharImage: (
    novelId: string,
    charId: string,
    base64: string,
    mime: string
  ) => Promise<string>;

  updateDQ: (
    novelId: string,
    partId: string,
    dqId: string,
    data: Partial<DiscussionQuestion>
  ) => Promise<void>;
  saveScene: (
    novelId: string,
    partId: string,
    dqId: string,
    base64: string,
    mime: string
  ) => Promise<string>;

  history: HistoryEntry[];
  addHistory: (entry: Omit<HistoryEntry, 'id' | 'createdAt'>) => void;
  clearHistory: () => void;

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

      setActiveNovel: (id) => set({ activeNovelId: id }),

      // 쓰기만 하고 로컬 state는 subscribe가 알아서 반영
      addNovel: async (novel) => {
        set({ activeNovelId: novel.id });
        await saveNovel(novel);
      },

      updateNovel: async (id, data) => {
        const novel = get().novels.find((n) => n.id === id);
        if (novel) await saveNovel({ ...novel, ...data });
      },

      deleteNovel: async (id) => {
        const fallbackId = get().novels.find((n) => n.id !== id)?.id ?? null;
        set({ activeNovelId: fallbackId });
        await fbDeleteNovel(id);
      },

      updateCharacter: async (novelId, charId, data) => {
        const novel = get().novels.find((n) => n.id === novelId);
        if (!novel) return;
        const updated = {
          ...novel,
          characters: novel.characters.map((c) =>
            c.id === charId ? { ...c, ...data } : c
          ),
        };
        await saveNovel(updated);
      },

      saveCharImage: async (novelId, charId, base64, mime) => {
        const novel = get().novels.find((n) => n.id === novelId);
        if (!novel) return '';
        const url = await saveCharacterImage(novel, charId, base64, mime);
        // imageBase64는 in-memory에만 저장 (Firebase엔 URL만)
        set((s) => ({
          novels: s.novels.map((n) =>
            n.id !== novelId
              ? n
              : {
                  ...n,
                  characters: n.characters.map((c) =>
                    c.id === charId
                      ? {
                          ...c,
                          imageUrl: url,
                          imageBase64: base64,
                          imageMime: mime,
                        }
                      : c
                  ),
                }
          ),
        }));
        return url;
      },

      updateDQ: async (novelId, partId, dqId, data) => {
        const novel = get().novels.find((n) => n.id === novelId);
        if (!novel) return;
        const updated = {
          ...novel,
          parts: novel.parts.map((p) =>
            p.id !== partId
              ? p
              : {
                  ...p,
                  discussionQuestions: p.discussionQuestions.map((dq) =>
                    dq.id === dqId ? { ...dq, ...data } : dq
                  ),
                }
          ),
        };
        await saveNovel(updated);
      },

      saveScene: async (novelId, partId, dqId, base64, mime) => {
        const novel = get().novels.find((n) => n.id === novelId);
        if (!novel) return '';
        const url = await saveSceneImage(novel, partId, dqId, base64, mime);
        // sceneImage는 in-memory에만 저장
        set((s) => ({
          novels: s.novels.map((n) =>
            n.id !== novelId
              ? n
              : {
                  ...n,
                  parts: n.parts.map((p) =>
                    p.id !== partId
                      ? p
                      : {
                          ...p,
                          discussionQuestions: p.discussionQuestions.map(
                            (dq) =>
                              dq.id === dqId
                                ? {
                                    ...dq,
                                    sceneImageUrl: url,
                                    sceneImage: base64,
                                    sceneMime: mime,
                                  }
                                : dq
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
            {
              ...entry,
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
            },
            ...s.history,
          ].slice(0, 200),
        })),
      clearHistory: () => set({ history: [] }),

      startSync: () => {
        const { unsubscribe: existing } = get();
        if (existing) existing();
        const unsub = subscribeNovels((novels) => set({ novels }));
        set({ unsubscribe: unsub });
      },

      stopSync: () => {
        const { unsubscribe } = get();
        if (unsubscribe) {
          unsubscribe();
          set({ unsubscribe: null });
        }
      },
    }),
    {
      name: 'novel-studio-v2',
      partialize: (state) => ({
        apiKey: state.apiKey,
        activeNovelId: state.activeNovelId,
        history: state.history.map((h) => ({ ...h, imageBase64: undefined })),
        novels: state.novels.map((n) => ({
          ...n,
          styleImageBase64: undefined,
          styleImageMime: undefined,
          characters: n.characters.map((c) => ({
            ...c,
            imageBase64: undefined,
            imageMime: undefined,
          })),
          parts: n.parts.map((p) => ({
            ...p,
            discussionQuestions: p.discussionQuestions.map((dq) => ({
              ...dq,
              sceneImage: undefined,
              sceneMime: undefined,
            })),
          })),
        })),
      }),
    }
  )
);
