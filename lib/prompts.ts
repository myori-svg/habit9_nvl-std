const DEFAULT_STYLE =
  'cozy heartwarming watercolor and colored pencil storybook illustration, soft hand-drawn outlines, warm golden light, muted pastels and earthy browns, framed by a decorative vine border';

export function getStyleRef(stylePrompt?: string): string {
  return stylePrompt || DEFAULT_STYLE;
}

export function parseChapters(
  summary: string
): { label: string; content: string }[] {
  if (!summary) return [];
  const lines = summary.split('\n');
  const chapters: { label: string; content: string }[] = [];
  let current: { label: string; lines: string[] } | null = null;
  for (const line of lines) {
    if (/^(chapter|챕터|ch\.?|pages?|페이지|쪽)\s*[\d-]+/i.test(line.trim())) {
      if (current)
        chapters.push({
          label: current.label,
          content: current.lines.join('\n').trim(),
        });
      current = { label: line.trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current)
    chapters.push({
      label: current.label,
      content: current.lines.join('\n').trim(),
    });
  return chapters;
}

export function extractCharNames(text: string): string[] {
  const matches = text.match(/\{([^}]+)\}/g)?.map((m) => m.slice(1, -1)) ?? [];
  return matches.filter((name, idx) => matches.indexOf(name) === idx);
}

// ── Template rendering ───────────────────────────────────────────
// 템플릿의 {{var}} 자리를 실제 값으로 치환
export function renderTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.split(`{{${key}}}`).join(value),
    template
  );
}

// ── Prompt templates (기본값, Firestore에 저장된 커스텀 템플릿이 있으면 그걸 우선 사용) ──

export const PROMPT_TEMPLATE_KEYS = [
  'dq',
  'composition',
  'charInfo',
  'charPrompt',
  'charImage',
  'scene',
] as const;

export type PromptTemplateKey = (typeof PROMPT_TEMPLATE_KEYS)[number];

// dq, composition 템플릿은 "무엇을 만들지"(내용 지침)만 담는다. 출력 형식은
// 사용자가 편집하는 템플릿 밖에서 코드가 소유한다 — Manual Mode는 아래
// *_OUTPUT_FORMAT_INSTRUCTION을 프롬프트 끝에 자동 첨부하고, Auto Mode는
// lib/output-format.ts의 응답 스키마로 강제한다.
export const DEFAULT_PROMPT_TEMPLATES: Record<PromptTemplateKey, string> = {
  dq: `소설 "{{novelTitle}}"의 챕터별 서머리를 보고 각 챕터에 맞는 Discussion Question을 생성해주세요.

아래 지침을 따라주세요:
- 초등학교 4학년 영어 학습자 수준에 맞게 작성
- 선택형 또는 의견이 갈리는 형식으로 구성 (문제 + 선택지 A, B 2개)
- 각 선택지가 한쪽으로 치우치지 않고 둘 다 설득력 있게 구성
- 질문을 최대한 흥미롭고 창의적으로 만들 것
- 각 챕터당 2-3개 질문
- 영어로 작성
- 주어진 서머리 범위 안에서만 출제할 것

소설 서머리:
{{selectedSummary}}`,

  composition: `각 <항목>별로 어울리는 배경화면을 생성할 수 있도록 화풍, 캐릭터 외형을 제외한 장면의 구도를 나타내는 이미지 생성 프롬프트를 생성해줘
- 문제 본문(Problem), 선택지 A, 선택지 B 각각에 대해 장면 구도 프롬프트를 만들 것
- 내용에 알맞게 캐릭터들의 구도도 설정하는데, 어떤 캐릭터가 어떤 구도를 잡고 있는지 명시할 것
- 주어진 내용에서 캐릭터가 느낄만한 표정을 구체적으로 묘사할 것
- 캐릭터명은 {}으로 감싸고, 어떤 캐릭터들이 등장하는지도 함께 알려줄 것{{characterNote}}

{{questionItems}}`,

  charInfo: `소설 "{{novelTitle}}"에 등장하는 캐릭터 "{{name}}"의 정보를 정리해주세요.

아래 내용을 포함해주세요:
- 나이 및 신체적 외형 (머리카락, 눈, 체형, 주로 입는 옷) — 나이는 "13세" 같은 정확한 숫자 대신 "초등학교 고학년" "10대 초반" 등 학년/생애주기로 완곡하게 표현할 것 (이미지 생성 단계에서 세이프티 필터 오탐 방지)
- 성격 특징
- 이야기에서의 역할

외형 묘사는 구체적으로. 150단어 이내.`,

  charPrompt: `아래 조건에 따라 캐릭터의 외형을 잘 드러나는 이미지 텍스트 프롬프트를 생성해주세요.
- Full-body storybook illustration
- 외형, 의상, 성격이 드러나는 표정과 포즈 묘사
- 성격 정보를 표정에 반영할 것
- 화풍/스타일은 언급하지 말 것 (이미지 생성 단계에서 별도로 적용됨)
- 나이는 "13 year old" 같은 정확한 숫자 대신 "young" "child" "student" 등으로 완곡하게 표현할 것 (세이프티 필터 오탐 방지)

<character info>
캐릭터명: {{charPromptName}}
{{charPromptInfo}}

프롬프트 텍스트만 출력. 영어로 작성.`,

  charImage: `캐릭터 {{charImageName}}의 이미지를 생성하기 위한 프롬프트를 작성해주세요.
  - Full-body storybook illustration
  - 스타일은 아래를 참고하고, 캐릭터의 외형과 성격이 잘 드러나도록 묘사해주세요.

<image style>
{{style}}

<character prompt>
캐릭터명: {{charImageName}}
{{charImageTextPrompt}}

프롬프트 텍스트만 출력. 영어로 작성.`,

  scene: `아래 지시 사항에 따라 이미지를 생성해주세요.

- 스타일은 <image style>을 따를 것{{styleImageNote}}
- 캐릭터는 <character prompt>에 따라 묘사하고, 캐릭터명은 {}로 구분
- 구도는 <composition>을 따를 것
- 표정은 역동적으로
- 이미지 비율: 16:9

<image style>
{{style}}

<composition>
{{sceneComposition}}

<character prompt>
{{charPromptsText}}`,
};

// ── Manual Mode 출력 형식 안내 (코드 소유, 템플릿과 별개로 프롬프트 끝에 첨부) ──
// 여기 적힌 구분자와 구조는 lib/output-format.ts의 파서(splitQuestionBlocks,
// splitCompositionScenes)가 읽는 규칙과 짝이다. 한쪽을 바꾸면 다른 쪽도 바꾼다.
// 예시는 특정 소설 내용이 아니라 구조만 보여주는 뼈대다.

export const DQ_OUTPUT_FORMAT_INSTRUCTION = `출력 형식 (반드시 지킬 것):
- 마크다운 외 다른 태그 없이, 전체를 코드블럭 하나로 감싸서 plain text로 반환
- 서로 다른 문제는 === 구분선으로 나눌 것
- 각 문제 안에서 문제(제목+본문), 선택지 A, 선택지 B는 --- 구분선으로 나눌 것
- 문제 제목은 "[Short Title] Headline question?" 형식으로 쓸 것

형식 예시 (내용이 아니라 구조만 참고):
===
1. [Short Title] Headline question in one line?
Two or three sentences of story context.
A question asking students to pick one and give 3 reasons:
---
Option A: Short label: "First-person statement supporting this choice."
---
Option B: Short label: "First-person statement supporting this choice."
===`;

export const COMPOSITION_OUTPUT_FORMAT_INSTRUCTION = `출력 형식 (반드시 지킬 것):
- 전체를 코드블럭 하나로 감싸서 반환
- 서로 다른 문제는 === 구분선으로 나누고, 입력된 문제의 순서와 개수를 그대로 유지할 것
- 각 문제는 --- 구분선으로 정확히 4구간으로 나눌 것: 제목 / Problem Image Prompt / Option A Image Prompt / Option B Image Prompt
- 제목 구간은 입력된 문제의 제목 줄, 그 아래 "Characters: {이름}, {이름}" 줄로 구성

형식 예시 (내용이 아니라 구조만 참고):
===
1. [Short Title] Headline question?
Characters: {Name1}, {Name2}
---
Problem Image Prompt:
Camera angle and framing, setting, lighting, where {Name1} and {Name2} are positioned, their facial expressions.
---
Option A Image Prompt:
Camera angle and framing, setting, lighting, character positions and expressions for choice A.
---
Option B Image Prompt:
Camera angle and framing, setting, lighting, character positions and expressions for choice B.
===`;

// ── 템플릿 자리표시자 규칙 ────────────────────────────────────────
// 템플릿마다 쓸 수 있는 {{자리표시자}}와, 없으면 내용이 프롬프트에 들어가지 않는
// 필수 자리표시자를 정의한다. 저장할 때는 이 규칙으로 검사하고(validatePromptTemplate),
// 이미 저장돼 있는 템플릿이 필수 자리표시자를 잃었으면 기본 템플릿으로 대체한다
// (resolvePromptTemplate).

export interface TemplateVariable {
  name: string;
  label: string;
  required?: boolean;
}

export const TEMPLATE_VARIABLES: Record<PromptTemplateKey, TemplateVariable[]> =
  {
    dq: [
      { name: 'novelTitle', label: '소설 제목' },
      {
        name: 'selectedSummary',
        label: '선택한 챕터의 서머리',
        required: true,
      },
    ],
    composition: [
      {
        name: 'questionItems',
        label: '선택한 챕터의 질문 목록',
        required: true,
      },
      {
        name: 'characterNote',
        label: '등록된 캐릭터로 제한하는 문구 (등록된 캐릭터가 없으면 빈칸)',
      },
    ],
    charInfo: [
      { name: 'novelTitle', label: '소설 제목' },
      { name: 'name', label: '캐릭터 이름', required: true },
    ],
    charPrompt: [
      { name: 'charPromptName', label: '캐릭터 이름' },
      { name: 'charPromptInfo', label: '캐릭터 정보', required: true },
    ],
    charImage: [
      { name: 'style', label: '화풍' },
      { name: 'charImageName', label: '캐릭터 이름' },
      {
        name: 'charImageTextPrompt',
        label: '캐릭터의 텍스트 프롬프트',
        required: true,
      },
    ],
    scene: [
      { name: 'style', label: '화풍' },
      {
        name: 'styleImageNote',
        label: '스타일 참고 이미지가 있을 때만 들어가는 문구',
      },
      { name: 'sceneComposition', label: '구도 프롬프트', required: true },
      {
        name: 'charPromptsText',
        label: '등장 캐릭터 프롬프트',
        required: true,
      },
    ],
  };

export function validatePromptTemplate(
  key: PromptTemplateKey,
  template: string
): { missing: string[]; unknown: string[] } {
  const variables = TEMPLATE_VARIABLES[key];
  const known = new Set(variables.map((v) => v.name));
  const used = [...template.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
  return {
    missing: variables
      .filter((v) => v.required && !used.includes(v.name))
      .map((v) => v.name),
    unknown: [...new Set(used.filter((name) => !known.has(name)))],
  };
}

export function resolvePromptTemplate(
  key: PromptTemplateKey,
  stored: string | undefined
): { template: string; missing: string[] } {
  if (stored === undefined)
    return { template: DEFAULT_PROMPT_TEMPLATES[key], missing: [] };
  const { missing } = validatePromptTemplate(key, stored);
  return missing.length > 0
    ? { template: DEFAULT_PROMPT_TEMPLATES[key], missing }
    : { template: stored, missing: [] };
}

// ── Prompt builders ──────────────────────────────────────────────
// templates 인자를 생략하면 기본 템플릿 사용. Step 컴포넌트에서는 스토어의 최신 커스텀 템플릿을 넘겨준다.

export function buildDQPrompt(
  novelTitle: string,
  selectedSummary: string,
  template: string = DEFAULT_PROMPT_TEMPLATES.dq
): string {
  return renderTemplate(template, {
    novelTitle,
    selectedSummary: selectedSummary || '(챕터를 선택하거나 직접 입력해주세요)',
  });
}

// 캐릭터 프롬프트(textPrompt)가 등록돼 있는 캐릭터만 골라 이름을 돌려준다.
// 장면 이미지 생성은 이 프롬프트와 이미지를 이름으로 찾아 붙이므로, 구도
// 프롬프트에서 이 캐릭터들은 등록된 이름 그대로 표기돼야 한다.
export function getPromptedCharacterNames(
  characters: { name: string; textPrompt?: string }[]
): string[] {
  return characters.filter((c) => c.textPrompt?.trim()).map((c) => c.name);
}

export function buildCharacterNote(
  characterNames?: string[],
  promptedCharacterNames?: string[]
): string {
  if (!characterNames || characterNames.length === 0) return '';
  const limitNote = `\n등장 가능한 캐릭터는 다음으로 한정합니다: ${characterNames.join(', ')}. 이 목록에 없는 새 캐릭터를 만들지 마세요.`;
  if (!promptedCharacterNames || promptedCharacterNames.length === 0)
    return limitNote;
  return `${limitNote}\n이 중 ${promptedCharacterNames.join(', ')}은(는) 이미 캐릭터 프롬프트가 등록돼 있으므로, 등장시킬 때 반드시 위에 적힌 이름 그대로 {}로 감싸서 표기할 것 (철자·대소문자·띄어쓰기를 바꾸거나 별칭·줄임말로 쓰지 말 것).`;
}

export function buildCompositionPrompt(
  questionItems: string,
  template: string = DEFAULT_PROMPT_TEMPLATES.composition,
  characterNames?: string[],
  promptedCharacterNames?: string[]
): string {
  const characterNote = buildCharacterNote(
    characterNames,
    promptedCharacterNames
  );
  return renderTemplate(template, { questionItems, characterNote });
}

export function buildCharInfoPrompt(
  novelTitle: string,
  name: string,
  template: string = DEFAULT_PROMPT_TEMPLATES.charInfo
): string {
  return renderTemplate(template, { novelTitle, name });
}

export function buildCharPromptPrompt(
  charPromptName: string,
  charPromptInfo: string,
  template: string = DEFAULT_PROMPT_TEMPLATES.charPrompt
): string {
  return renderTemplate(template, {
    charPromptName: charPromptName || '(이름)',
    charPromptInfo: charPromptInfo || '(캐릭터 정보를 입력하세요)',
  });
}

export function buildCharImagePrompt(
  style: string,
  charImageName: string,
  charImageTextPrompt: string,
  template: string = DEFAULT_PROMPT_TEMPLATES.charImage
): string {
  return renderTemplate(template, {
    style,
    charImageName: charImageName || '(이름)',
    charImageTextPrompt:
      charImageTextPrompt || '(④ 단계에서 텍스트 프롬프트를 먼저 생성해주세요)',
  });
}

export function buildScenePrompt(
  style: string,
  hasStyleImage: boolean,
  sceneComposition: string,
  charPromptsText: string,
  template: string = DEFAULT_PROMPT_TEMPLATES.scene
): string {
  return renderTemplate(template, {
    style,
    styleImageNote: hasStyleImage ? ' (스타일 참고 이미지도 함께 제공)' : '',
    sceneComposition:
      sceneComposition || '(구도 프롬프트를 입력하거나 DQ를 선택하세요)',
    charPromptsText: charPromptsText || '(캐릭터를 선택하세요)',
  });
}
