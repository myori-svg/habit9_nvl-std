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
  savePromptTemplate as fbSavePromptTemplate,
  saveCharacterImage,
  saveNovel,
  saveSceneImage,
  subscribeNovels,
  subscribePromptTemplates,
} from './firestore';
import type { PromptTemplateKey } from './prompts';

interface AppStore {
  novels: Novel[];
  activeNovelId: string | null;
  setActiveNovel: (id: string) => void;
  addNovel: (novel: Novel) => Promise<void>;
  updateNovel: (id: string, data: Partial<Novel>) => Promise<void>;
  addStyleRefImage: (novelId: string, base64: string, mime: string) => void;
  removeStyleRefImage: (novelId: string, imageId: string) => void;
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
  setPartDQs: (
    novelId: string,
    partId: string,
    questions: { text: string; compositionPrompt?: string }[]
  ) => Promise<void>;
  addChapterParts: (
    novelId: string,
    chapters: { label: string; content: string }[]
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

  promptTemplates: Partial<Record<PromptTemplateKey, string>>;
  savePromptTemplate: (
    key: PromptTemplateKey,
    template: string
  ) => Promise<void>;

  unsubscribe: (() => void) | null;
  promptUnsubscribe: (() => void) | null;
  startSync: () => void;
  stopSync: () => void;
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      novels: [],
      activeNovelId: null,

      setActiveNovel: (id) => set({ activeNovelId: id }),

      // 쓰기만 하고 로컬 state는 subscribe가 알아서 반영
      addNovel: async (novel) => {
        set({ activeNovelId: novel.id });
        await saveNovel(novel);
      },

      // novel 문서 전체를 saveNovel(setDoc)로 덮어쓰는 함수들은, 쓰기 직후
      // onSnapshot echo가 로컬 state에 반영되기 전에 다음 호출이 get().novels를
      // 다시 읽으면 stale한 novel을 기준으로 재저장해 직전 변경을 덮어써버린다
      // (여러 캐릭터를 순차 자동생성할 때 앞 캐릭터 저장분이 유실되는 원인이었음).
      // 그래서 saveNovel 호출 전에 로컬 state도 optimistic하게 먼저 갱신한다.
      updateNovel: async (id, data) => {
        const novel = get().novels.find((n) => n.id === id);
        if (!novel) return;
        const updated = { ...novel, ...data };
        set((s) => ({
          novels: s.novels.map((n) => (n.id === id ? updated : n)),
        }));
        await saveNovel(updated);
      },

      // styleRefImages는 Firestore에 저장되지 않는 in-memory 전용 필드라
      // saveNovel을 거치지 않고 로컬 state만 직접 갱신한다 (그러지 않으면 다음
      // onSnapshot에서 바로 사라짐)
      addStyleRefImage: (novelId, base64, mime) =>
        set((s) => ({
          novels: s.novels.map((n) =>
            n.id === novelId
              ? {
                  ...n,
                  styleRefImages: [
                    ...(n.styleRefImages ?? []),
                    { id: crypto.randomUUID(), base64, mime },
                  ],
                }
              : n
          ),
        })),

      removeStyleRefImage: (novelId, imageId) =>
        set((s) => ({
          novels: s.novels.map((n) =>
            n.id === novelId
              ? {
                  ...n,
                  styleRefImages: (n.styleRefImages ?? []).filter(
                    (img) => img.id !== imageId
                  ),
                }
              : n
          ),
        })),

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
        set((s) => ({
          novels: s.novels.map((n) => (n.id === novelId ? updated : n)),
        }));
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
        set((s) => ({
          novels: s.novels.map((n) => (n.id === novelId ? updated : n)),
        }));
        await saveNovel(updated);
      },

      setPartDQs: async (novelId, partId, questions) => {
        const novel = get().novels.find((n) => n.id === novelId);
        if (!novel) return;
        const updated = {
          ...novel,
          parts: novel.parts.map((p) =>
            p.id !== partId
              ? p
              : {
                  ...p,
                  discussionQuestions: questions.map((q) => ({
                    id: crypto.randomUUID(),
                    text: q.text,
                    compositionPrompt: q.compositionPrompt ?? '',
                  })),
                }
          ),
        };
        set((s) => ({
          novels: s.novels.map((n) => (n.id === novelId ? updated : n)),
        }));
        await saveNovel(updated);
      },

      addChapterParts: async (novelId, chapters) => {
        const novel = get().novels.find((n) => n.id === novelId);
        if (!novel) return;
        const newParts = chapters.map((c) => ({
          id: crypto.randomUUID(),
          label: c.label,
          content: c.content,
          discussionQuestions: [],
        }));
        const updated = { ...novel, parts: [...novel.parts, ...newParts] };
        set((s) => ({
          novels: s.novels.map((n) => (n.id === novelId ? updated : n)),
        }));
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

      promptTemplates: {},
      savePromptTemplate: async (key, template) => {
        await fbSavePromptTemplate(key, template);
      },

      unsubscribe: null,
      promptUnsubscribe: null,

      startSync: () => {
        const { unsubscribe: existing, promptUnsubscribe: existingPrompt } =
          get();
        if (existing) existing();
        if (existingPrompt) existingPrompt();
        const unsub = subscribeNovels((novels) => set({ novels }));
        const promptUnsub = subscribePromptTemplates((promptTemplates) =>
          set({ promptTemplates })
        );
        set({ unsubscribe: unsub, promptUnsubscribe: promptUnsub });
      },

      stopSync: () => {
        const { unsubscribe, promptUnsubscribe } = get();
        if (unsubscribe) {
          unsubscribe();
          set({ unsubscribe: null });
        }
        if (promptUnsubscribe) {
          promptUnsubscribe();
          set({ promptUnsubscribe: null });
        }
      },
    }),
    {
      name: 'novel-studio-v2',
      partialize: (state) => ({
        activeNovelId: state.activeNovelId,
        history: state.history.map((h) => ({ ...h, imageBase64: undefined })),
        novels: state.novels.map((n) => ({
          ...n,
          styleRefImages: undefined,
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
