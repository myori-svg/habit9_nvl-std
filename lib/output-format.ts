// 질문(DQ)·구도 프롬프트의 출력 구조. Manual Mode는 붙여넣은 텍스트를 아래
// 파서로 읽고, Auto Mode는 Gemini 응답 스키마로 같은 구조를 강제한 뒤 같은
// 텍스트 모양으로 조립해 저장한다. 그래서 두 모드가 저장하는 문자열의 모양이
// 같고, 장면 분리(splitCompositionScenes)도 하나로 통한다.
//
// Manual Mode 프롬프트에 붙는 형식 안내문은 lib/prompts.ts의
// *_OUTPUT_FORMAT_INSTRUCTION이며, 그 안내문과 이 파일의 구분자·라벨 규칙은 짝이다.

const QUESTION_DELIMITER_PATTERN = /^[ \t]*={3,}[ \t]*$/m;
const PART_DELIMITER_PATTERN = /^[ \t]*-{3,}[ \t]*$/m;
const PART_DELIMITER = '---';
export const QUESTION_DELIMITER = '===';

// 결과 전체가 코드블럭 하나로 감싸져 있으면 안쪽만 꺼낸다.
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```[^\n]*\n([\s\S]*?)\n?```$/);
  return (fenced ? fenced[1] : trimmed).trim();
}

// ── 파서 (Manual Mode 붙여넣기 / 저장된 구도 프롬프트 읽기) ──────────

export function splitQuestionBlocks(raw: string): string[] {
  return stripCodeFence(raw)
    .split(QUESTION_DELIMITER_PATTERN)
    .map((block) => block.trim())
    .filter(Boolean);
}

export interface SceneSplit {
  main: string;
  optionA: string;
  optionB: string;
}

const SCENE_SLOTS = ['main', 'optionA', 'optionB'] as const;

const SCENE_LABELS: Record<(typeof SCENE_SLOTS)[number], RegExp> = {
  main: /^Problem(?:\s+Image)?\s+Prompt\s*:\s*/i,
  optionA: /^Option\s*A(?:\s+Image)?\s+Prompt\s*:\s*/i,
  optionB: /^Option\s*B(?:\s+Image)?\s+Prompt\s*:\s*/i,
};

// 구도 프롬프트 하나(문제 하나분)를 본문/Option A/Option B 장면으로 나눈다.
// 구간 앞머리 라벨("Problem Image Prompt:" 등)이 있으면 라벨로 찾고, 라벨이 없으면
// 위치로 판단한다. 제목 구간이 맨 앞에 붙은 4구간 구조는 제목 구간을 건너뛴다.
// 없는 구간은 빈 문자열이며, 호출하는 쪽이 빈 구간의 이미지 생성을 건너뛴다.
export function splitCompositionScenes(compositionPrompt: string): SceneSplit {
  const parts = stripCodeFence(compositionPrompt)
    .split(PART_DELIMITER_PATTERN)
    .map((part) => part.trim())
    .filter(Boolean);

  const labeled: SceneSplit = { main: '', optionA: '', optionB: '' };
  let hasLabel = false;
  for (const part of parts) {
    for (const slot of SCENE_SLOTS) {
      if (SCENE_LABELS[slot].test(part)) {
        labeled[slot] = part.replace(SCENE_LABELS[slot], '').trim();
        hasLabel = true;
      }
    }
  }
  if (hasLabel) return labeled;

  const scenes = parts.length >= 4 ? parts.slice(1, 4) : parts.slice(0, 3);
  return {
    main: scenes[0] ?? '',
    optionA: scenes[1] ?? '',
    optionB: scenes[2] ?? '',
  };
}

// ── Auto Mode: Gemini 응답 스키마 + 조립 ─────────────────────────────

export interface QuestionItem {
  title: string;
  headline: string;
  body: string;
  optionA: string;
  optionB: string;
}

export const QUESTIONS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Short dilemma title without brackets',
          },
          headline: {
            type: 'string',
            description:
              'One-line headline question ending with a question mark',
          },
          body: {
            type: 'string',
            description:
              'Story context, then a line asking students to pick one and give 3 reasons',
          },
          optionA: {
            type: 'string',
            description: 'Short label followed by a first-person statement',
          },
          optionB: {
            type: 'string',
            description: 'Short label followed by a first-person statement',
          },
        },
        required: ['title', 'headline', 'body', 'optionA', 'optionB'],
      },
    },
  },
  required: ['questions'],
} as const;

export interface CompositionItem {
  characters: string[];
  problemScene: string;
  optionAScene: string;
  optionBScene: string;
}

// characterNames가 있으면 등장인물을 그 목록 안에서만 고르도록 강제한다.
export function buildCompositionResponseSchema(characterNames: string[]) {
  return {
    type: 'object',
    properties: {
      characters: {
        type: 'array',
        items:
          characterNames.length > 0
            ? { type: 'string', enum: characterNames }
            : { type: 'string' },
        description: 'Characters appearing in this question',
      },
      problemScene: {
        type: 'string',
        description:
          'Image prompt for the problem scene. Wrap character names in {}',
      },
      optionAScene: {
        type: 'string',
        description:
          'Image prompt for the option A scene. Wrap character names in {}',
      },
      optionBScene: {
        type: 'string',
        description:
          'Image prompt for the option B scene. Wrap character names in {}',
      },
    },
    required: ['characters', 'problemScene', 'optionAScene', 'optionBScene'],
  } as const;
}

function parseJsonObject(text: string, what: string): Record<string, unknown> {
  try {
    const value = JSON.parse(text);
    if (value && typeof value === 'object') {
      return value as Record<string, unknown>;
    }
  } catch {
    // 아래에서 원문 앞부분과 함께 오류로 던진다
  }
  throw new Error(
    `Gemini의 ${what} 응답을 JSON으로 읽지 못했습니다: ${text.slice(0, 80)}`
  );
}

function requireString(
  source: Record<string, unknown>,
  field: string,
  what: string
): string {
  const value = source[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Gemini의 ${what} 응답에 ${field} 값이 없습니다`);
  }
  return value.trim();
}

export function parseQuestionsResponse(text: string): QuestionItem[] {
  const questions = parseJsonObject(text, '질문').questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('Gemini가 질문을 하나도 만들지 못했습니다');
  }
  return questions.map((raw) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    return {
      title: requireString(item, 'title', '질문'),
      headline: requireString(item, 'headline', '질문'),
      body: requireString(item, 'body', '질문'),
      optionA: requireString(item, 'optionA', '질문'),
      optionB: requireString(item, 'optionB', '질문'),
    };
  });
}

export function parseCompositionResponse(text: string): CompositionItem {
  const item = parseJsonObject(text, '구도');
  const characters = Array.isArray(item.characters)
    ? item.characters.filter((name): name is string => typeof name === 'string')
    : [];
  return {
    characters,
    problemScene: requireString(item, 'problemScene', '구도'),
    optionAScene: requireString(item, 'optionAScene', '구도'),
    optionBScene: requireString(item, 'optionBScene', '구도'),
  };
}

function characterNameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

// {이름} 표기 중 등록된 캐릭터 이름과 대소문자·공백만 다른 것을 등록된 이름
// 그대로로 맞춘다. 장면 이미지 생성이 캐릭터 프롬프트와 이미지를 이름으로 찾기
// 때문에, 프롬프트가 등록된 캐릭터는 어떤 경로로 만든 구도 프롬프트든 이 보정을
// 거쳐 저장한다. 등록되지 않은 이름과 {} 밖의 표기는 건드리지 않는다.
export function normalizeCharacterNames(
  text: string,
  registeredNames: string[]
): string {
  const registered = new Map(
    registeredNames.map((name) => [characterNameKey(name), name])
  );
  return text.replace(/\{([^{}]+)\}/g, (braced, inner: string) => {
    const exact = registered.get(characterNameKey(inner));
    return exact ? `{${exact}}` : braced;
  });
}

function withoutOptionLabel(text: string, option: 'A' | 'B'): string {
  return text.replace(new RegExp(`^Option\\s*${option}\\s*:\\s*`, 'i'), '');
}

// Manual Mode 결과와 같은 모양: "[제목] 헤드라인 / 본문 / --- / Option A / --- / Option B"
export function assembleQuestionText(question: QuestionItem): string {
  return [
    `[${question.title}] ${question.headline}`,
    question.body,
    PART_DELIMITER,
    `Option A: ${withoutOptionLabel(question.optionA, 'A')}`,
    PART_DELIMITER,
    `Option B: ${withoutOptionLabel(question.optionB, 'B')}`,
  ].join('\n');
}

// Manual Mode 결과와 같은 4구간 모양: 제목+등장인물 / Problem / Option A / Option B
export function assembleCompositionText(
  questionText: string,
  composition: CompositionItem
): string {
  const titleLine = questionText.split('\n')[0].trim();
  const characterLine =
    composition.characters.length > 0
      ? `\nCharacters: ${composition.characters.map((name) => `{${name}}`).join(', ')}`
      : '';
  return [
    `${titleLine}${characterLine}`,
    PART_DELIMITER,
    `Problem Image Prompt:\n${composition.problemScene}`,
    PART_DELIMITER,
    `Option A Image Prompt:\n${composition.optionAScene}`,
    PART_DELIMITER,
    `Option B Image Prompt:\n${composition.optionBScene}`,
  ].join('\n');
}
