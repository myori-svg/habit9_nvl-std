# CLAUDE.md

## 프로젝트 개요
- 프로젝트명: {{PROJECT_NAME}}
- 설명: {{PROJECT_DESCRIPTION}}

## 기술 스택
- Frontend: {{FRONTEND_STACK}}
- Backend: {{BACKEND_STACK}}
- Database: {{DATABASE}}
- External API: {{EXTERNAL_API}}
- Linter: {{LINTER}}

## 디렉토리 구조
```
{{DIRECTORY_STRUCTURE}}
```

## 코딩 컨벤션

### Frontend
- `type`으로 통일 (`interface`와 혼용 금지)
- `import type` 필수 (verbatimModuleSyntax)
- 함수형 컴포넌트만 사용
- 커스텀 훅으로 비즈니스 로직 분리
- App.tsx는 구조 셸 역할만

### Backend
- Layered Architecture: routes → controllers → services → models
- 환경변수는 .env로 관리, 절대 커밋 금지
