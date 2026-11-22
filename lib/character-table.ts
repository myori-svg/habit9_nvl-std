// Word·스프레드시트에서 복사한 캐릭터 표를 읽어 캐릭터별 정보로 바꾼다. 복사한 표는
// 텍스트로 붙여넣으면 칸은 탭, 행은 줄바꿈으로 구분된다. 첫 칸이 캐릭터 이름이고
// 나머지 칸이 정보다.

export interface CharacterTableRow {
  name: string;
  info: string;
}

// 첫 칸이 이 값이면 그 행은 데이터가 아니라 열 제목 행이다.
const HEADER_NAME_CELLS = new Set([
  'character',
  'characters',
  'name',
  'names',
  '캐릭터',
  '이름',
  '등장인물',
  '인물',
]);

// 이름 옆에 붙은 이모지와, 이모지를 잇거나 그림 모양으로 바꾸는 눈에 보이지 않는
// 문자(ZWJ, 변형 선택자)를 이름 비교와 화면 표시에서 뺀다. 눈에 안 보이는 문자를
// 소스에 그대로 두지 않으려고 이스케이프 문자열로 조립한다.
const ZERO_WIDTH_JOINER = '\\u200d';
const VARIATION_SELECTOR_16 = '\\ufe0f';
const EMOJI_PATTERN = new RegExp(
  `\\p{Extended_Pictographic}|\\p{Emoji_Modifier}|${ZERO_WIDTH_JOINER}|${VARIATION_SELECTOR_16}`,
  'gu'
);

function withoutEmoji(text: string): string {
  return text.replace(EMOJI_PATTERN, '').replace(/\s+/g, ' ').trim();
}

// 이름을 글자·숫자 덩어리로 쪼갠 소문자 목록. 따옴표·마침표·이모지 같은 장식은
// 덩어리 사이에서 사라지므로 `Jeffrey "Maniac" Magee 🏃`와 `jeffrey maniac magee`가
// 같은 목록이 된다.
function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function isSubset(part: string[], whole: string[]): boolean {
  return part.every((token) => whole.includes(token));
}

// 같은 이름인지 비교할 때 쓰는 키. 대소문자·따옴표·마침표·이모지가 달라도 같은
// 이름이면 같은 키가 된다.
export function characterNameKey(name: string): string {
  return nameTokens(name).join(' ');
}

export interface CharacterMatch<T> {
  characters: T[];
  // true면 이름이 같은 캐릭터를 찾은 것이고, false면 이름의 일부만 겹쳐서 찾은 것이다.
  sameName: boolean;
}

// 표의 이름 칸에 해당하는 등록된 캐릭터를 찾는다. 이름이 같은 캐릭터가 있으면 그
// 캐릭터만, 없으면 한쪽 이름의 모든 덩어리가 다른 쪽에 들어 있는 캐릭터를 모두
// 돌려준다. 그래서 "Hester and Lester Beale" 한 행이 등록된 Hester와 Lester
// 둘 다에 연결되고, 별명("Maniac")만 등록해 둔 경우에도 전체 이름 행과 연결된다.
export function findMatchingCharacters<T extends { name: string }>(
  rowName: string,
  characters: T[]
): CharacterMatch<T> {
  const rowTokens = nameTokens(rowName);
  if (rowTokens.length === 0) return { characters: [], sameName: false };
  const candidates = characters
    .map((character) => ({ character, tokens: nameTokens(character.name) }))
    .filter(({ tokens }) => tokens.length > 0);

  const sameName = candidates.filter(
    ({ tokens }) =>
      tokens.length === rowTokens.length && isSubset(tokens, rowTokens)
  );
  if (sameName.length > 0) {
    return {
      characters: sameName.map(({ character }) => character),
      sameName: true,
    };
  }

  return {
    characters: candidates
      .filter(
        ({ tokens }) =>
          isSubset(tokens, rowTokens) || isSubset(rowTokens, tokens)
      )
      .map(({ character }) => character),
    sameName: false,
  };
}

// 열 제목을 칸 내용 앞에 붙인다. 제목이 이미 물음표나 콜론으로 끝나면 콜론을
// 더하지 않는다("Who is this character? 내용").
function joinLabel(label: string, value: string): string {
  if (!label) return value;
  return /[?？:：]$/.test(label) ? `${label} ${value}` : `${label}: ${value}`;
}

// 표 텍스트를 이름과 정보 텍스트의 행 목록으로 바꾼다.
// - 열 제목 행이 있으면 각 정보 칸 앞에 제목을 붙인다("제목: 내용").
// - 정보 칸이 모두 비어 있는 행과 이름이 없는 행은 건너뛴다.
export function parseCharacterTable(text: string): CharacterTableRow[] {
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (line.includes('\t')) {
      rows.push(line.split('\t').map((cell) => cell.trim()));
    } else if (rows.length > 0) {
      // 탭이 없는 줄은 앞 행의 마지막 칸 안에서 줄이 바뀐 것으로 본다.
      const previous = rows[rows.length - 1];
      const last = previous.length - 1;
      previous[last] = `${previous[last]}\n${line.trim()}`.trim();
    }
  }

  const hasHeader =
    rows.length > 0 &&
    HEADER_NAME_CELLS.has(withoutEmoji(rows[0][0]).toLowerCase());
  const header = hasHeader ? rows[0] : [];
  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows.flatMap((cells) => {
    const name = withoutEmoji(cells[0]);
    const info = cells
      .slice(1)
      .map((value, i) => ({ label: header[i + 1] ?? '', value }))
      .filter(({ value }) => value)
      .map(({ label, value }) => joinLabel(label, value))
      .join('\n');
    return name && info ? [{ name, info }] : [];
  });
}
