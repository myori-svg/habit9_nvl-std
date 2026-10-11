# AGENTS.md — nvl-std 프로젝트 가이드

## 프로젝트 개요
소설 창작 보조 웹앱. 학원 선생님이 실사용 중인 인터널 프로덕트.
Manual Mode (현재 운영 중) → Auto Mode (보류) 순으로 개발.

## 기술 스택
- **프레임워크**: Next.js (App Router)
- **DB**: Firebase Firestore
- **스토리지**: Firebase Storage
- **AI**: Gemini API (텍스트 + 이미지 생성 모두 Gemini로 통일)
- **상태관리**: Zustand (`lib/store.ts`)
- **스타일**: Tailwind CSS

## 디렉토리 구조
```
nvl-std/
├── .tasks/               # 태스크 트래커 (작업 전 반드시 읽기)
│   ├── README.md         # 전체 현황 인덱스
│   ├── active/           # 진행 중 / 긴급
│   ├── backlog/          # 나중에
│   ├── hold/             # 보류
│   └── done/             # 완료
├── app/
│   └── api/              # API route handlers
│       ├── setup-novel/
│       ├── generate-character-in.../
│       ├── fetch-image/
│       ├── generate-questions/
│       ├── generate-scene/
│       └── generate-scene-prompt/
├── components/           # React 컴포넌트
├── lib/
│   ├── firebase.ts       # Firebase 초기화
│   ├── firestore.ts      # Firestore 헬퍼
│   ├── gemini.ts         # Gemini API 호출
│   ├── prompts.ts        # 프롬프트 통합 관리 (MM-16)
│   └── store.ts          # Zustand 스토어
├── types/
│   └── index.ts
└── docs/
```

## 작업 규칙

### 시작 전
1. `.tasks/README.md` 읽어서 전체 현황 파악
2. 해당 티켓 md 열어서 `의존성` 확인
3. `depends_on`에 적힌 티켓이 `done/` 폴더에 없으면 그 티켓부터 작업
4. 선행 티켓 미완료 시 그것부터 처리

### 작업 중
- 프롬프트는 반드시 `lib/prompts.ts`에서 관리 (하드코딩 금지)
- Zustand 상태는 컴포넌트 내에서 `useStore` 훅으로만 접근 (`useStore.getState()` 직접 호출 금지)
- Gemini API 호출은 `lib/gemini.ts` 통해서

### 완료 후
- 티켓 md의 완료 조건 체크
- 티켓 파일을 `active/` → `done/`으로 이동
- `.tasks/README.md` 상태 업데이트

## 주의사항
- 선생님이 실사용 중 — 배포된 기능 건드릴 때 주의
- Firebase 인증 없는 공유 DB 구조 (현재 단일 접근)
- Gemini restriction 걸릴 수 있음 — 프롬프트 수정 유연하게 대응 가능하도록 설계

## prod 브랜치 ↔ nvl-std-prod repo 연동
- `prod` 브랜치는 별도 Vercel 프로젝트(이 repo의 dev와는 다른, Gemini 없이 OpenAI만 쓰는 운영 배포)의 기준 브랜치다.
- `nvl-std-prod`(https://github.com/myori-svg/nvl-std-prod)는 그 `prod` 브랜치 내용만 담은 단일 브랜치(`main`) 미러 repo다 — 외부 포크를 이 repo로만 유도해서 dev 등 다른 브랜치가 노출되지 않게 하려는 목적.
- **`prod` 브랜치에 새 커밋이 머지될 때마다(PR 머지 직후), 사용자가 다시 요청하지 않아도 바로 아래 명령으로 `nvl-std-prod`의 `main`에도 동일하게 반영한다:**
  ```
  git fetch origin prod && git push https://github.com/myori-svg/nvl-std-prod.git refs/remotes/origin/prod:refs/heads/main
  ```
- dev 브랜치는 이 동기화 대상이 아니다 — dev는 이 repo 자체(habit9_nvl-std)의 Production 배포(nvl-std-personal.vercel.app)로만 가고, nvl-std-prod와는 무관하다.