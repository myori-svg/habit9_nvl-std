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

// renderTemplate의 역연산: 완성된 텍스트에서 vars 값과 일치하는 부분을 다시 {{var}}로 되돌림
// (사용자가 수정한 프롬프트를 "템플릿"으로 저장할 때만 사용)
export function reverseTemplate(
  rendered: string,
  vars: Record<string, string>
): string {
  return Object.entries(vars).reduce((text, [key, value]) => {
    if (!value) return text;
    return text.split(value).join(`{{${key}}}`);
  }, rendered);
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

export const DEFAULT_PROMPT_TEMPLATES: Record<PromptTemplateKey, string> = {
  dq: `소설 "{{novelTitle}}"의 챕터별 서머리를 보고 각 챕터에 맞는 Discussion Question을 생성해주세요.

아래 지침을 따라주세요:
- 초등학교 4학년 영어 학습자 수준에 맞게 작성
- 선택형 또는 의견이 갈리는 형식으로 구성 (문제 + 선택지 2~3개)
- 주어진 <예시>를 참고해서 질문을 최대한 흥미롭고 창의적으로 만들어주세요
- 각 챕터당 2-3개 질문
- 영어로 작성
- 각 문제(제목+본문)와 선택지들은 --- 구분선으로 나눌 것
- 서로 다른 문제 간에는 === 구분선으로 나눌 것
- 마크다운 외 다른 태그 없이 코드블럭으로 감싸서 plain text로 반환

<예시>
1. [The Freedom Trade-off] Safety in a Cage vs. Danger in the Wild?
Inside the NIMH lab, the rats have everything: free food, scientists who take care of them, and no predators. But they are trapped in cages. Outside, they can go wherever they want, but they might starve or be hunted
If you were Nicodemus, which life would you choose? Pick one and give 3 reasons:
Option A: The Golden Cage (Safe): "I'll stay in the lab. I get injections that make me smart, I have plenty of food, and I never have to worry about cats or cold weather."
Option B: The Scary Wild (Free): "I'm leaving! I'd rather be hungry and scared but free to make my own choices than be a prisoner in a clean cage."

소설 서머리:
{{selectedSummary}}`,

  composition: `각 <항목>별로 어울리는 배경화면을 생성할 수 있도록 화풍, 캐릭터 외형을 제외한 장면의 구도를 나타내는 이미지 생성 프롬프트를 생성해줘
각 문제는 === 구분선으로 나누고, 문제 본문과 각 선택지는 --- 구분선으로 구분할 것
답변 반환시에는 동일한 구분선 구조를 유지하고, 각 항목의 시작에는 제목을 붙여서 코드블럭으로 반환할 것
내용에 알맞게 캐릭터들의 구도도 설정하는데, 어떤 캐릭터가 어떤 구도를 잡고 있는지 명시할 것
주어진 내용에서 캐릭터가 느낄만한 표정을 구체적으로 묘사할 것
캐릭터명은 {}으로 감싸고, 어떤 캐릭터들이 등장하는지 각 항목 답변 제일 앞에 모아서 알려줄 것{{characterNote}}

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

export function buildCharacterNote(characterNames?: string[]): string {
  return characterNames && characterNames.length > 0
    ? `\n등장 가능한 캐릭터는 다음으로 한정합니다: ${characterNames.join(', ')}. 이 목록에 없는 새 캐릭터를 만들지 마세요.`
    : '';
}

export function buildCompositionPrompt(
  questionItems: string,
  template: string = DEFAULT_PROMPT_TEMPLATES.composition,
  characterNames?: string[]
): string {
  const characterNote = buildCharacterNote(characterNames);
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
