# my-en 인계

2026-10-04 첫 개인용 로컬 MVP 완료. 대상 `/Users/ryu-medi/Desktop/projects/my-en`. 제한된 파일쓰기 환경 때문에 허용 작업 폴더에서 구현·검증 후 승인된 rsync로 반영. .git/기존 설정/다른 프로젝트 보존.

## 바로 이어받기

1. README / PROGRESS / docs/LEARNING / docs/STACK 확인.
2. git status --short --branch / git log -1, 새 AGENTS.md·사용자 수정 확인. origin git@github.com:WillowRyu/my-en.git, 기본 브랜치 master.
3. npm run dev:127.0.0.1:5186. PWA는 npm run build && npm run preview:127.0.0.1:4186. 정확 버전 의존성·포함 WAV·dist 제공.
4. npm run check, PLAYWRIGHT_BROWSERS_PATH=/tmp/my-en-playwright npm run test:e2e. E2E는4186을 스스로 사용하므로 현재 my-en 미리보기만 닫고 실행. 다른 서비스/프로세스 종료 금지. /tmp 브라우저가 사라졌으면 같은 env로 npx playwright install chromium webkit.
5. schemaVersion/lesson version/phrase version과 이전백업 보호를 함께 고려. 현재버전1 외에는 읽기거부+원본보존.

## 구조

- content.ts:7수업15표현8모듈 roadmap. 여행/일상 주제 변경 가능. Ryu는 연습 이름.
- model.ts:순수 상태 전이/자동 선택/복습/날짜·IANA시간대/Zod. listening, speaking, recall evidence 분리. 문제 정답을 말하기 숙달로 사용하지 않음.
- storage.ts:my-en:progress:v1 + my-en:previous:v1. 새로고침 복원, 손상 차단, JSON 백업. 저장 실패 때 메모리 사용+백업 안내. 포트/브라우저가 바뀌면 JSON으로 이동.
- Study.tsx/Media.tsx/audio.ts:audio 종료/녹음 트랙 해제/Blob URL 폐기. 사용자 녹음 서버저장 없음. FileAudioAdapter가 향후 provider 경계. STT/점수 없음.
- pwa.ts/build-sw.mjs:전체 precache+controller 확인, 빌드해시 버전, WAV Range. 기본 SW 수명; 앱 탭 모두 닫고 재열기. 개발모드 SW 없음.
- App.tsx/Settings.tsx:오늘/기록/설정 hash routing, 백업/복구, 모바일 하단 메뉴.

## 검증 증거

타입·lint경고0·단위20·빌드 통과. Chromium/WebKit desktop/mobile40/40통과. docs/screenshots/*-home.png, *-study.png. playwright-report/index.html 및 test-results/.last-run.json 제공(Git 제외).

첫7일 전체 state 진행은 단위테스트. 브라우저는 첫수업 완주와 핵심 오류/재개. 날짜전환·DST·시간대·버전/중복완료는 모델테스트. MediaRecorder는 합성 스트림이므로 사용자 실마이크·음질 보장은 아님. 실기기/PWA설치 후속 확인 필요.

WebKit 오프라인은 setOffline 도구 제한 때문에 자체 임시서버 종료로 실제 손실 검증; 포트는 OS 독립할당. 종료한 것은 테스트 소유 서버뿐. Kuji5173/4100/54328/8029/54329와 분리.

## 제약/후속

- 공개 전 WAV 교체. Apple 시스템 음성은 개인 비상업용에 제한, 공개 공유·재배포 불가. WAV/dist 공개/force add 금지. 직접 녹음·재배포 가능한 합법 자산 준비 후 공개 정책 재확인.
- 2026-10-06 사용자가 커밋·푸시 승인. 대상은 기존 공개 저장소 WillowRyu/my-en의 master. repo local 저자 WillowRyu / stainer1004@gmail.com, 전역 설정 변경 금지. 배포는 요청되지 않음.
- API키/유료호출/업로드/계정/CI 금지 범위 유지. 기존 키 발견해 사용하지 않음.
- 사용자 체험으로 길이/표현/모범 음질 개선 우선. 영어교사 검토·실기기·설치·7일체험 후속.
- 로그인/기기동기화/자유채팅/발음평가/외부AI/푸시/스토어는 범위 밖.
- 사용자가 my-en을 Codex에 직접 등록했다고 보고. 프로젝트/세션/앱 설정 추가수정 없음. 위임 세션을 일반 프로젝트 채팅으로 이전했다고 주장하지 않음. 파일 기준 진행은 PROGRESS.md에서 열 수 있음.

미리보기 실행 상태는 마지막 인계 아래에 기록. 컨텍스트 부족 시 소유 프로세스/진행중 검사만 남기고 안전한 경계에서 갱신. kuji-online에는 손대지 않음.

## 마지막 실행 상태

2026-10-06 (한국 시간), 개발환경 정리 시 확인:

- 개발 5186 / 미리보기 4186에 실행 중인 서버 없음. 저장소를 작업 경로로 사용하는 Node/npm 프로세스도 없음. 별도 종료할 프로세스가 없어 종료 명령은 실행하지 않음.
- Node 24.2.0 / npm 11.3.0. `npm ls --depth=0` 정상, 설치 의존성과 lockfile 선언 일치. 기존 의존성·음성 15개·빌드·검증 자료 보존.
- 체험 재개: 저장소에서 `npm run preview`, http://127.0.0.1:4186/ . 개발 재개: `npm run dev`, http://127.0.0.1:5186/ . 소스 수정 뒤 미리보기 전 `npm run build` 필요.
- 이번 정리는 실행 상태·의존성·자산 확인과 문서 갱신만 수행. 앞의 타입/린트/단위/브라우저 검증 결과는 첫 MVP 검증 기록이며 이번에 다시 실행한 결과가 아님.
- 브라우저 학습 기록은 그대로 유지. Kuji의 저장소·서비스·프로세스, 전역 환경, Git identity 변경 없음. 커밋·푸시·배포 없음.

## GitHub 버전 관리 · 2026-10-06

- SSH 인증 계정 WillowRyu 확인. gh CLI의 활성 계정은 Siwon-medi이지만 계정 전환 없이 기존 origin의 SSH 연결을 사용.
- 소스·문서·테스트만 커밋 대상. 개인용 WAV 15개, dist, node_modules, 테스트 보고서는 .gitignore로 제외. 원격의 새 체크아웃에는 음성을 별도 준비해야 함.
- 최신 커밋과 동기화 여부는 git log -1 / git status --short --branch / git ls-remote --heads origin master로 확인.

커밋 전 재검증: `npm run check` 통과(타입·lint·단위 20/20·빌드), Chromium/WebKit 모바일·데스크톱 `test:e2e` 40/40 통과. 브라우저 테스트가 띄운 my-en 서버는 테스트 종료 시 정리됨. 실기기 마이크 검증과는 구분.
