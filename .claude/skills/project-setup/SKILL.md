---
name: project-setup
description: 새 프로젝트 시작할 때 기술스택, 디렉토리 구조, CLAUDE.md, docs, .gitmessage를 순서대로 세팅해주는 스킬. 새 프로젝트 시작, 초기 세팅, 프로젝트 구성할 때 사용.
disable-model-invocation: true
---

# Project Setup Skill

새 프로젝트를 시작할 때 아래 단계를 순서대로 진행해. 각 단계마다 반드시 답변을 받은 후 다음 단계로 넘어가.

---

## Step 1. 프로젝트 기본 정보 수집

다음을 순서대로 하나씩 물어봐:

1. 프로젝트 이름이 뭐야?
2. 어떤 서비스야? (한 줄로 설명)
3. 프론트엔드만 있어, 아니면 백엔드도 있어?
4. 외부 API 연동이 필요해? 있으면 어떤 거야?

---

## Step 2. 기술 스택 결정

답변을 바탕으로 아래를 물어봐:

1. 프론트엔드 프레임워크는? (React / Vue / 기타)
2. TypeScript 쓸 거야?
3. 스타일링은? (Tailwind / CSS Modules / styled-components / 기타)
4. 백엔드가 있으면: 런타임과 프레임워크는? (Node.js+Express / 기타)
5. 백엔드가 있으면: DB는? (MongoDB / PostgreSQL / 기타)
6. 린터는? (Biome / ESLint / 기타)

---

## Step 3. 디렉토리 구조 생성

수집한 정보를 바탕으로 디렉토리 구조를 제안하고 확인받아.
확인되면 실제로 디렉토리와 빈 파일들을 생성해.

프론트+백 구조 기준:
```
프로젝트명/
├── client/
│   └── src/
│       ├── components/
│       ├── hooks/
│       ├── api/
│       └── pages/
├── server/
│   └── src/
│       ├── routes/
│       ├── controllers/
│       ├── models/
│       └── services/
├── docs/
├── .claude/
│   ├── skills/
│   └── commands/
├── .gitignore
├── .gitmessage
└── CLAUDE.md
```

프론트만 있는 구조 기준:
```
프로젝트명/
├── src/
│   ├── components/
│   ├── hooks/
│   ├── api/
│   └── pages/
├── docs/
├── .claude/
│   ├── skills/
│   └── commands/
├── .gitignore
├── .gitmessage
└── CLAUDE.md
```

---

## Step 4. CLAUDE.md 생성

[templates/CLAUDE.md](templates/CLAUDE.md)를 읽고 수집한 정보로 채워서 프로젝트 루트에 생성해.

---

## Step 5. PRD 생성

[templates/PRD.md](templates/PRD.md)를 읽고 수집한 정보로 채워서 `docs/PRD.md`에 생성해.

---

## Step 6. .gitmessage 생성

[templates/gitmessage](templates/gitmessage)를 읽고 프로젝트 루트에 `.gitmessage`로 생성해.
생성 후 아래 명령어도 실행해:

```bash
git config commit.template .gitmessage
```
## Step 7. 슬래시 커맨드 세팅
templates/commands/ 안의 파일들을 프로젝트의 `.claude/commands/`에 복사해.

---

## Step 8. 완료 보고

모든 세팅이 완료되면 아래 형식으로 요약해줘:

```
✅ 프로젝트 세팅 완료

📁 생성된 구조: (디렉토리 트리)
📄 생성된 파일: CLAUDE.md / docs/PRD.md / .gitmessage
🛠️ 기술 스택: (확정된 스택)

다음 단계: npm init 또는 vite 세팅을 진행하세요.
```
