# 2026-10-11 설명·응용 학습 검증

작업 기준: `/Users/ryu-medi/Desktop/projects/my-en`, `master`, HEAD `88c3cbe0d204efc7030c5aa95113b43490ed3d2f`, 시작 작업 트리 clean. 사본 `/Users/ryu-medi/Documents/Codex/2026-10-08/task-2/my-en-learning-work`에서 기존 의존성·브라우저·31음성을 재사용했다. 새 설치·음성 제작·외부 AI·유료 호출·커밋·푸시·배포 없음.

## 실제 통과

- `npm run typecheck`: 통과. 새 모델·UI·브라우저 검사 타입 포함.
- `npm run lint`: 통과, 오류/경고0. 자원 부족으로 한 번 시작하지 않은 호출과 코드 const 수정 전 실패는 최종 통과와 구분.
- `npm test -- --maxWorkers=1 --no-file-parallelism`: **59/59**, 3파일, 437ms. 기존43 + 새16. 13수업 전단계/저장 round trip, 구 기록 이관, v2 raw 고정·실패 시 저장 중단, 자연스러운 다른 답변의 자동 오답 방지, 복습/힌트/예약 보호 확인.
- `npm run build`: 타입 포함 통과, Vite109ms. JS467.39KB/gzip140.24KB, CSS23.59KB/gzip5.62KB. 오프라인39파일/기존31음성, `my-en-360f9a4c9907`.
- 새 브라우저 시나리오: **Chromium desktop/mobile 각3개, 총6/6**. 설명→8턴 대화→변형→자기답변→완료, 입력/단계 재개, 선택형6문제/난이도/건너뛰기, v2 단어·설정·raw 원본/내려받기, 지연 회상에서 예문 숨김·다른 표현 자기 확인·힌트 분리.
- 기존 Chromium desktop 회귀: **9개 통과**. 첫 기초 수업 완주/중복 방지, 오답·힌트·재개, 짧은 모드·음성 실패, 마이크 거부/녹음 취소·트랙 해제, 오프라인 재개·WAV Range, 백업 복원·초기화/복구, 손상 보호·키보드.
- 새 Chromium mobile home/explain/recall PNG를 실제 열어 읽기 흐름·입력·주요 버튼을 확인. desktop/mobile 새 PNG6개와 갱신된 기존 PNG 제공. 모든 화면을 실기기에서 확인한 것은 아님.

## 중단·미확인

- 최초 새 검사: 접힌 난이도 메뉴의 숨겨진 버튼을 접근성 locator로 찾는 테스트 실패. 메뉴 요약 검사로 수정한 후 Chromium desktop/mobile6/6 통과. 이 실패를 앱 기능 오류로 확정하지 않음.
- 브라우저 중 두 번 system-wide memory free34%에서 guard가 종료. 중단1: load1=1.36, jobRSS0.64GiB. 중단2: load1=3.93, jobRSS1.06GiB. 전체 Chromium36개 완료를 주장하지 않는다. 기존 mobile 및 desktop 나머지6개(음성/320px, 단어 회상, quick→정규, v1 브라우저 이관, 저장 실패 재시도, speaking-only 복습)의 최신 전체 재실행은 미완료다. 일부 내용은 단위 검사·새 브라우저 v2 확인·이전 날짜의 검사와 구분해야 한다.
- WebKit desktop/mobile6개는 `browserContext.newPage: Target page, context or browser has been closed`로 앱 실행 전에 실패. 기존 WebKit의 **about:blank 생성도 같은 실패**를 한 번 확인. 새 설치/환경 변경은 금지 범위라 수행하지 않음. Safari 계열 최신 UI 검증은 미확인이다.
- 이번 전체 HTML 보고서는 완결되지 않았으므로 원본의 이전 HTML 보고서를 덮어쓰지 않는다. 이 문서와 PROGRESS가 이번 검사 범위다.
- 실제 소요 시간/학습효과, 교육 전문가 검토, 실기기 키보드·설치, 새 수업 듣기·발음은 검증하지 않음. 자유 답변 문법·자연스러움 자동 평가를 제공하지 않는다.

## 자원과 정리

resource guard는 load1<=8, `memory_pressure` system-wide free>=35%, 검사 process tree RSS<=2GiB, 디스크15GiB+예상0.10GiB+2GiB 및18GiB 근처 성장 중단을 확인했다. 단일 worker로 순차 실행. 단위/린트/빌드 sampled RSS 최대0.57GiB, 브라우저 sampled RSS 최대1.06GiB. 디스크는 약19.4GiB 수준, 상한 내였으나 메모리가 순간 내려가 중단했다.

첫 중단 때 남은 사본 preview PID26318만 경로를 정확히 확인 후 종료. guard의 이후 중단 정리는 검사 자식의 시작 시각/명령을 다시 확인해 처리. 마지막 확인 시4186 리스너와 전용 브라우저/사본 서버 잔여0. Kuji와 타 프로젝트·백업·캐시·사용자 기록 삭제/수정 없음.

원본 반영: 검증된 소스·콘텐츠·테스트·문서·스크린샷·빌드31개 파일을 복사하고 전체 체크섬을 확인했다. master/HEAD88c3cbe 유지, 변경은 미커밋 상태. 원본의 이전 테스트 보고서·음성·의존성·설정·학습 데이터는 보존, 파일 삭제·커밋·푸시·배포 없음.
