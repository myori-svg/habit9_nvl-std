export interface Novel {
  id: string;
  title: string;
  summary: string;
  styleImageBase64?: string;
  styleImageMime?: string;
  styleImageUrl?: string;      // Firebase Storage URL
  stylePrompt: string;
  characters: Character[];
  parts: NovelPart[];
  createdAt: string;
}

export interface Character {
  id: string;
  name: string;
  info: string;
  textPrompt: string;
  imageBase64?: string;        // in-memory only
  imageMime?: string;
  imageUrl?: string;           // Firebase Storage URL (persistent)
  createdAt: string;
}

export interface NovelPart {
  id: string;
  label: string;
  discussionQuestions: DiscussionQuestion[];
}

export interface DiscussionQuestion {
  id: string;
  text: string;
  compositionPrompt: string;
  sceneImage?: string;         // in-memory only
  sceneMime?: string;
  sceneImageUrl?: string;      // Firebase Storage URL (persistent)
}

export type SetupStep =
  | 'idle'
  | 'generating-dq'
  | 'generating-composition'
  | 'extracting-characters'
  | 'generating-char-info'
  | 'generating-char-prompts'
  | 'generating-char-images'
  | 'done';

export interface SetupProgress {
  step: SetupStep;
  message: string;
  current?: number;
  total?: number;
}

export interface HistoryEntry {
  id: string;
  novelId: string;
  novelTitle: string;
  type: 'scene' | 'character-image';
  label: string;
  imageUrl?: string;           // Firebase Storage URL
  imageBase64?: string;        // in-memory fallback
  imageMime?: string;
  prompt: string;
  createdAt: string;
}
