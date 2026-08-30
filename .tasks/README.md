# nvl-std 프로젝트 트래커

## 작업 규칙

* 작업 시작 전 이 파일 먼저 읽기
* 해당 티켓 md 읽고 `의존성` 확인 후 착수
* 작업 완료 시 티켓을 `done/`으로 이동하고 이 파일 상태 업데이트

## 의존성 포맷

| 키 | 의미 |
|-|-|
| `depends_on: [티켓ID]` | 해당 티켓 완료 전엔 시작 불가 (하드 블로킹) |
| `blocks: [티켓ID]` | 이 티켓이 완료돼야 해당 티켓 시작 가능 |
| `recommends: [티켓ID]` | 먼저 하면 좋지만 블로킹은 아님 |
| `없음` | 의존성 없음 |

## 티켓 상태

|상태|폴더|
|-|-|
|진행 중 / 미구현|`active/`|
|나중에|`backlog/`|
|보류|`hold/`|
|완료|`done/`|

\---

## 🔴 긴급 (active)

|티켓|제목|카테고리|상태|
|-|-|-|-|
|[MM-17](active/MM-17.md)|SaveResultBox useStore 패턴 수정|Manual Mode|미구현|
|[MM-18](active/MM-18.md)|프롬프트 인라인 편집 UI|Manual Mode|미구현|
|[MM-08](active/MM-08.md)|파이프라인 재설계|Manual Mode|미구현|
|[SA-02](active/SA-02.md)|이미지 Firebase 저장 함수|저장·아카이브|진행 중|
|[SA-03](active/SA-03.md)|이미지 업로드 UI|저장·아카이브|미구현|
|[CH-06](active/CH-06.md)|캐릭터 이미지 생성 파트 신설|캐릭터 관리|미구현|
|[CH-08](active/CH-08.md)|캐릭터 이미지 업로드|캐릭터 관리|미구현|
|[MM-07](active/MM-07.md)|결과 저장 (이미지)|Manual Mode|미구현|

## 🟢 나중에 (backlog)

|티켓|제목|카테고리|
|-|-|-|
|[MM-10](backlog/MM-10.md)|DQ 아카이빙|Manual Mode|
|[MM-11](backlog/MM-11.md)|장면 생성 캐릭터 자동 감지|Manual Mode|
|[MM-12](backlog/MM-12.md)|장면 생성 결과 저장 모달 재배치|Manual Mode|
|[MM-19](backlog/MM-19.md)|프롬프트 버전 관리|Manual Mode|
|[CH-04](backlog/CH-04.md)|중복 등록 방지|캐릭터 관리|
|[CH-05](backlog/CH-05.md)|캐릭터 프롬프트 subtab 재배치|캐릭터 관리|
|[SA-04](backlog/SA-04.md)|이미지 export|저장·아카이브|
|[AR-01](backlog/AR-01.md)|Archive 탭 구현|저장·아카이브|
|[UX-02](backlog/UX-02.md)|새로고침 경고 모달|공통 UX|
|[UX-04](backlog/UX-04.md)|API 키 저장 보안|공통 UX|
|[GR-01](backlog/GR-01.md)|Grammar Studio 기획|Grammar Studio|
|[PP-01](backlog/PP-01.md)|PPT 콘텐츠 생성|PPT Generator|
|[PP-02](backlog/PP-02.md)|PPT 조립 (PPTX Skill API)|PPT Generator|
|[PP-03](backlog/PP-03.md)|PPT 마무리 편집|PPT Generator|

## ✅ 완료 (done)

|티켓|제목|카테고리|
|-|-|-|
|[MM-16](done/MM-16.md)|프롬프트 파일 분리|Manual Mode|
|[MM-20](done/MM-20.md)|DQ 프롬프트 챕터 선택 미반영 버그 수정|Manual Mode|
|[AI-01](done/AI-01.md)|Gemini SDK 마이그레이션 (전체 API 호출 장애 수정)|AI 연동|
|[UX-01](done/UX-01.md)|사이드바 숨기기 (모바일 반응형)|공통 UX|

## ⏸ 보류 (hold)

|티켓|제목|카테고리|보류 이유|
|-|-|-|-|
|[AM-01](hold/AM-01.md)|Auto Mode 전체 파이프라인|Auto Mode|Gemini API 결제 후 재개|
|[AM-02](hold/AM-02.md)|캐릭터 이미지 자동 생성|Auto Mode|AM-01 완료 후|
|[AM-03](hold/AM-03.md)|장면 이미지 자동 생성|Auto Mode|AM-01 완료 후|
|[UX-03](hold/UX-03.md)|사용자 인증|공통 UX|현재 공유 DB 단일 접근 구조|
|[UX-05](hold/UX-05.md)|Google Drive 연동|공통 UX|-|
|[MM-19](hold/MM-19.md)|프롬프트 버전 관리|Manual Mode|저장 정책 결정 후|



