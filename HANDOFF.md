# my-en 인계

2026-10-04 첫 개인용 로컬 MVP 완료. 대상 `/Users/ryu-medi/Desktop/projects/my-en`. 제한된 파일쓰기 환경 때문에 허용 작업 폴더에서 구현·검증 후 승인된 rsync로 반영. .git/기존 설정/다른 프로젝트 보존.

## 바로 이어받기

1. README / PROGRESS / docs/LEARNING / docs/STACK 확인.
2. git status --short --branch / git log -1, 새 AGENTS.md·사용자 수정 확인. origin git@github.com:WillowRyu/my-en.git, 기본 브랜치 master.
3. npm run dev:127.0.0.1:5186. PWA는 npm run build && npm run preview:127.0.0.1:4186. 정확 버전 의존성·포함 WAV·dist 제공.
4. 기존 의존성 재사용, 단위 `npm test -- --maxWorkers=1 --no-file-parallelism`, 브라우저 `PLAYWRIGHT_BROWSERS_PATH=/tmp/my-en-playwright npm run test:e2e -- --workers=1`. 자원 기준 확인 후 순차 실행. E2E는4186을 스스로 사용하므로 현재 my-en 미리보기만 닫고 실행. 다른 서비스/프로세스 종료 금지. 이번 요청에서 새 브라우저/의존성 설치 금지. 전용 브라우저가 없으면 미실행 검사를 보고.
5. schemaVersion/lesson version/phrase version/course version과 이전백업 보호를 함께 고려. 현재 schemaVersion3, v1/v2 읽기 이관·원본 보존, 그 외는 읽기거부+원본보존.

## 구조

- content.ts:기존 7수업15표현16단어8모듈 roadmap. curriculum.ts:실용6/확장7수업, 설명·8턴 대화·응용·회상. 여행/일상 주제 변경 가능. Ryu는 연습 이름.
- model.ts:순수 상태 전이/자동 선택/복습/날짜·IANA시간대/Zod. listening, speaking, recall evidence 분리. 문제 정답을 말하기 숙달로 사용하지 않음.
- storage.ts:my-en:progress:v1 + my-en:previous:v1, 첫 이관 원본 my-en:migration:v1/v2. 새로고침 복원, 손상 차단, JSON 백업. 저장 실패 때 메모리 사용+백업 안내. 포트/브라우저가 바뀌면 JSON으로 이동.
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

## 어휘 연결과 기록 보완 · 2026-10-08 (구현·검증 완료)

- 작업 사본: `/Users/ryu-medi/Documents/Codex/2026-10-08/task-2/my-en-work`. 기준 HEAD 9908890. 사용자 직접 승인 후 검증된 소스·문서·테스트·음성·빌드 등 76개 파일을 원본 `/Users/ryu-medi/Desktop/projects/my-en`에 반영하고 체크섬 일치를 확인. 브랜치 master와 HEAD는 유지하며 변경 사항은 미커밋 상태. 기존 설정·브라우저 학습 기록·의존성·Git 메타데이터는 건드리지 않음. 커밋·푸시·배포 없음.
- 새 `legacy.ts`: 기존 v1 구조 검증. `model.ts`: schemaVersion 2, 정규 완료 판정, due skill/word direction, 당일 간격 보호, 문장 조합 오답, 단어 기록. 기존 저장 키 유지. 첫 이관 원본은 `my-en:migration:v1`로 별도 보관.
- 새 `WordStudy.tsx`: 뜻/소리→양방향 어휘 회상→연결 문장. 하루 새 단어 기본 2개(설정 1~3), 짧은 모드 1개. 단어 WAV 16개 추가, 총 음성 31개. 공개 전 교체 제약 유지.
- `storage.ts`는 `{saved, backupSaved, warning}` 반환. 복원/초기화/설정은 저장 성공을 확인해 안내. 손상 원본·미지원 버전 자동 덮어쓰기 차단 유지.
- 타입·lint 통과, 단위 43/43 실제 통과. build 통과(오프라인 39파일/31음성). Chromium/WebKit desktop/mobile E2E 60/60 실제 통과, 마지막 버튼 배치 변경 관련 4/4 추가 통과. 전부 단일 worker, 부하 상한 8 아래에서 실행. 테스트 서버/임시 브라우저 정리 확인. 전체 60개 HTML 보고서는 `playwright-report/index.html`, 화면은 docs/screenshots. 실제 사용자 마이크·음질·키보드·학습 효과와 구분.
- 외부 AI·음성 업로드·유료 호출·의존성 설치·커밋·푸시·배포 안 함. 테스트는 단일 worker로 직렬 실행. 단어 학습 기본 버튼은 음성 없이 진행 가능. 하루 새 단어 1~3개 설정(기본2), 당일 여러 세션에도 상한 유지. 16개는 첫 7일 표현에서 뽑은 초기 연결 어휘이고 추가100개 과정은 구현하지 않음.

## 설명·응용 학습 강화 · 2026-10-11

- 작업 기준: 원본 `/Users/ryu-medi/Desktop/projects/my-en`, master / HEAD `88c3cbe0d204efc7030c5aa95113b43490ed3d2f`, 시작 시 clean. 작업 사본 `/Users/ryu-medi/Documents/Codex/2026-10-08/task-2/my-en-learning-work`. 검증된 변경31개 파일을 원본에 반영하고 체크섬 확인 완료. HEAD 유지, 작업 트리는 이번 변경으로 미커밋 상태.
- 사용자 피드백: 기존 내용이 쉽고 짧으며 설명 부족. 기본 시작점을 실용 문장으로 변경, 기초/실용/확장 직접 선택·선택형6문제 제안·아는 수업 건너뛰기/되돌리기·개별 수업 선택 구현. 공인 수준 추정 없음.
- 실용6/확장7 총13수업. 설명26·예문39·8턴 대화13(104턴)·대화확인26·변형39·자기답변26·지연회상26. 과거/계획/이유/비교/요청/문제 해결부터 진행·완료·조건·조언·관계절·기간·간접질문. 회차15~25분은 설계 목표, 보장 효과나 강제 시간 없음.
- 새 경계 `curriculum.ts`, `course.ts`, `calendar.ts`, `CourseHome.tsx`, `CourseStudy.tsx`. 기존 색상·서체·전용 학습 UI 유지. 새 음성 제작 없음, 텍스트 기본·소리 내어 읽기 선택. 외부 AI·유료 호출·음성 업로드 없음.
- 제한된 변형은 여러 작성 답안/축약/부호 허용. 범위 밖 답변은 자동 오답으로 단정하지 않고 비교 안내. 자유 답변은 예문/이유/자기 확인 기준을 제공하며 자동 문법·자연스러움 평가 없음. 수업 경험과 지연 회상·자기 확인을 분리.
- schemaVersion3, v2 validator 유지 + 빈 course 추가. v1 동결 validator 유지. 단어·기초 active/시도/설정/진도/시간 보존, 읽기만으로는 쓰지 않음. 첫 v2→v3 저장 전 raw 원본 `my-en:migration:v2` 고정, 보관 실패 시 새 저장 중단. 기존 v1 원본/저장키/백업 계약 보존. v3 백업은 이전 앱에서 읽기 불가.
- 단위59/59·타입·lint·build 실제 통과. 초기 브라우저 검사는 숨겨진 선택 메뉴를 검사한 테스트 실패 후 메모리34%에서 자원 guard가 중단. 실패 원인은 닫힌 details 속 버튼을 접근성 locator로 찾은 것이며 메뉴 요약 검사로 수정. 테스트 소유 preview 잔여 PID26318만 정확한 경로 확인 후 종료. 전체 새 브라우저 검사 결과는 최종 기록으로 갱신.
- 자원 계약: host load1<=8, memory_pressure의 system-wide free>=35%, 검사 process tree RSS<=2GiB, disk>=15GiB+예상필요량(0.10GiB)+2GiB 및18GiB 근처 성장 중단. 단일 worker, 감시하며 조건 초과 시 검사 소유 프로세스만 중단·정리. Kuji 파일·프로세스·백업·캐시·다른 사용자 데이터 삭제 없음.
- 실사용 소요 시간/학습효과·교육 전문가 콘텐츠 검토·새 수업 듣기/발음·실기기 키보드 검증은 남아 있음. 커밋·푸시·배포는 이번 요청 범위 밖.

최종 검사 상태: 단위59/59·타입·lint·build 통과. 새 Chromium desktop/mobile6/6 + 기존 desktop9개 통과. 전체 Chromium36개는 메모리34%에서 중단해 미완료. WebKit은 앱 실행 전 페이지 생성 실패, 빈 페이지도 동일 실패로 최신 Safari UI 미확인. 새 화면6개 확인 자료 제공. 4186/전용 브라우저 잔여0 확인. 세부 범위는 [이번 검증](docs/VERIFICATION-2026-10-11.md). 원본 반영31개 파일 체크섬 일치 확인. 기존 설정·학습 데이터·음성·의존성·Git 메타데이터 보존. 파일 삭제·커밋·푸시·배포 없음.
