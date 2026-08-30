export interface StyleRefImage {
  id: string;
  base64: string;
  mime: string;
}

export interface Novel {
  id: string;
  title: string;
  summary: string;
  styleRefImages?: StyleRefImage[]; // in-memory only, multiple ref images for style consistency
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
  imageBase64?: string; // in-memory only
  imageMime?: string;
  imageUrl?: string; // Firebase Storage URL (persistent)
  imageGenerated?: boolean; // Auto pipeline: image already generated, skip regeneration
  createdAt: string;
}

export interface NovelPart {
  id: string;
  label: string;
  content: string; // 챕터 원문 (파일 업로드 파싱 결과)
  discussionQuestions: DiscussionQuestion[];
}

export type SceneSlot = 'main' | 'optionA' | 'optionB';

export interface SceneImage {
  base64?: string; // in-memory only
  mime?: string;
  url?: string; // Firebase Storage URL (persistent)
}

export interface DiscussionQuestion {
  id: string;
  text: string;
  compositionPrompt: string;
  // 구도 프롬프트의 3분할(본문/Option A/Option B) 구조를 그대로 따라가는
  // 장면 이미지 슬롯. Auto Mode 파이프라인이 채움.
  sceneImages?: Partial<Record<SceneSlot, SceneImage>>;
  /** @deprecated sceneImages.main으로 대체됨. 기존에 저장된 문서 호환용으로만 남김. */
  sceneImage?: string; // in-memory only
  /** @deprecated sceneImages.main으로 대체됨. */
  sceneMime?: string;
  /** @deprecated sceneImages.main으로 대체됨. */
  sceneImageUrl?: string; // Firebase Storage URL (persistent)
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
  imageUrl?: string; // Firebase Storage URL
  imageBase64?: string; // in-memory fallback
  imageMime?: string;
  prompt: string;
  createdAt: string;
}
