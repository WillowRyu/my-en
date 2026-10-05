# 진행 현황

2026-10-04 · 첫 개인용 로컬 MVP 구현/검증 완료.

## 완료

- 빈 repo / remote `git@github.com:WillowRyu/my-en.git` 확인. master unborn. 기존 파일 없음. repo AGENTS.md/.agents/skills 없음. 전역 Codex 지침 확인. 현재 Sol 작업에서 Astra 위임 순서 적용 안 함.
- React19.3.0 / Vite8.3.2 / TypeScript6.0.3 / Zod4.6.5. 공식 문서·npm 안정 태그/peer 확인, lockfile 고정. TS7은 안정 lint 지원 범위 밖이어서 제외.
- 7일15표현(새 표현 하루2~3개), 이전표현 재사용, 듣기→뜻선택→문장조합→선택 녹음/재생→힌트 없는 회상.
- 다음 수업 자동 선택, 최대3표현 복습, 2표현5분모드, skill별 진도·간격복습, 이어하기, 세션/콘텐츠 버전·시도·힌트 저장.
- 백업/검증 후 복원/직전 저장본 복구/초기화 확인, 손상기록 덮어쓰기 차단, 저장 실패 안내.
- 실제 WAV15개 생성, 0.75배 듣기, 로컬 MediaRecorder, 거부/취소/지원없음/재생실패 대체경로. 외부 업로드 없음.
- PWA manifest/아이콘, 23개 파일 전체 캐시+서비스 워커 제어 확인 후 준비 표시. WAV Range응답과 오프라인 화면/음성.
- README/HANDOFF, 스택 근거·학습 설계·8모듈 확장 로드맵, 4환경 홈/학습 화면 PNG.
- 사용자가 Codex에 my-en 프로젝트를 직접 등록했다고 알려주어 등록 UI 작업 중단. 기존 프로젝트/세션/앱 설정 보존.

## 최종 검증

| 검사 | 결과 |
|---|---|
| npm run typecheck | 통과 |
| npm run lint | 오류0, 경고0 |
| npm test | 20/20 통과 |
| npm run build | 통과; JS gzip 약109KB, 음성 약824KB |
| Chromium desktop/mobile | 각10개, 20/20 통과 |
| WebKit desktop/mobile | 각10개, 20/20 통과 |
| 음성 PCM | 15/15 실제 샘플·길이·신호 확인, 각0.72~1.73초 |
| 반응형/터치 | 320/390/1440 너비 가로 넘침 없음, 핵심버튼48px 이상 |

브라우저 전체 최종 실행: 40/40 통과, 약30초. 실제 첫수업 완료/중복완료 방지, 오답·힌트·회상 가리기, 새로고침·뒤로가기·pause, 오디오실패/재시도, 마이크 거부/지원없음, 실제 MediaRecorder 합성스트림 녹음·재생, 취소·이동·늦은 권한 응답 후 트랙 해제, 오프라인 새로고침/Range재생, JSON 백업·복원·초기화·직전복구, 손상기록 보존/키보드 검증.

## 발견/해결한 문제

- 샌드박스의 macOS say가 exit0과 빈 WAV를 반환. PCM 길이 확인으로 발견. 설치된 음성을 로컬 서비스 접근으로 재생성, 생성기에 빈 음성 검출 추가. 외부 음성 API/다운로드 없음.
- WebKit mock getUserMedia 할당/track stop spy가 안정적으로 적용되지 않아 navigator의 테스트 전용 객체와 실제 native track readyState 확인으로 수정. 앱 기능을 가짜 녹음으로 대체하지 않음.
- Playwright WebKit의 setOffline/network interception이 서비스 워커 앞에서 navigation을 차단. [공식 도구 제한](https://playwright.dev/docs/service-workers) 확인 후, 테스트가 만든 독립 임시 HTTP 서버만 종료해 실제 연결 단절 상태의 WebKit 캐시 화면·음성을 검증. 캐시 누락 요청은 실패하는 것도 확인. Chromium은 native offline emulation.
- 학습량을 부풀리지 않도록 시간 추정 대신 실제 표현 수와 “내 속도로” 표시.

## 남은 사용자 확인/범위

- 사용자 실기기 마이크, iPhone 홈 화면 설치, 사람이 들은 음질·발음, 실제7일 학습 난이도 미검증. 자동 검증과 구분.
- 개인용 macOS 음성은 공개 전 재배포 가능한 음성으로 교체 필요. WAV/dist는 Git 제외. [라이선스](https://www.apple.com/legal/sla/docs/macOSGoldenGate.pdf) 2F.
- 로그인/동기화/외부 AI/발음평가/채팅/푸시/스토어/배포/CI 미구현.
- 개발5186, 미리보기4186, strictPort, loopback. Kuji 저장소·서비스·DB·컨테이너·프로세스 수정/중단 없음.
- 커밋/푸시/배포/계정/유료호출/API키/토큰/전역Git identity 변경 없음.

실행/인계: [README.md](README.md), [HANDOFF.md](HANDOFF.md).

## 개발환경 정리 · 2026-10-06

- 개발 5186 / 미리보기 4186 비실행, my-en 작업 경로의 Node/npm 프로세스 없음 확인. 종료할 프로세스 없음.
- Node 24.2.0 / npm 11.3.0, `npm ls --depth=0` 정상. package.json/lockfile 의존성 선언 일치.
- 소스·음성 15개·node_modules·dist·검증 자료 및 브라우저 학습 기록 보존.
- README에 체험(`npm run preview`), 개발(`npm run dev`), 새 체크아웃 준비를 구분하고 포트별 기록 차이를 명시. HANDOFF의 오래된 실행 상태 갱신.
- 코드/의존성 변경 없음. 앞의 자동 검증은 MVP 완료 시 결과이며 이번 정리에서 재실행하지 않음.
- Kuji와 전역 환경은 변경하지 않음. 커밋·푸시·배포 없음.

## GitHub 버전 관리 · 2026-10-06

- 사용자 요청으로 첫 커밋·푸시 승인. 기존 공개 저장소 WillowRyu/my-en, 기본 브랜치 master. SSH 인증 계정 WillowRyu 확인.
- 커밋 저자 WillowRyu / stainer1004@gmail.com을 저장소 local 범위에서 설정. 전역 Git/GitHub 계정 설정은 유지.
- 개인용 음성 WAV·dist·의존성·테스트 보고서 제외. 소스·문서·테스트만 버전 관리. 게시 대상 텍스트에서 주요 자격 증명 패턴 없음 확인.
- 배포·외부 API·Kuji 관련 작업 없음.

커밋 전 재검증: `npm run check` 통과(타입·lint·단위 20/20·빌드), Chromium/WebKit 모바일·데스크톱 `test:e2e` 40/40 통과. 브라우저 테스트가 띄운 my-en 서버는 테스트 종료 시 정리됨. 실기기 마이크 검증과는 구분.
