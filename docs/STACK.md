# 안정 스택 선택 기록

확인일 2026-10-04. 공식 문서와 npm 공식 registry의 `latest` 및 `peerDependencies`를 조회한 뒤 정확 버전과 package-lock을 고정했다. 최신 실험 버전보다 도구 간 호환성을 우선했다.

| 도구 | 선택 | 근거 |
|---|---|---|
| React / React DOM | 19.3.0 | [공식 현재 버전](https://react.dev/versions), [registry](https://registry.npmjs.org/react/latest). 버튼 중심 SPA, 익숙한 생태계. 서버 렌더링 필요 없음. |
| Vite | 8.3.2 | [공식 가이드](https://vite.dev/guide/), [registry](https://registry.npmjs.org/vite/latest). 안정 빌드/빠른 로컬 개발. Node 요구 `^20.19.0 || >=22.12.0`. |
| @vitejs/plugin-react | 6.1.1 | registry peer `vite ^8.0.0`. 실험적인 React Compiler 설정 제외. |
| TypeScript | 6.0.3 | [공식 문서](https://www.typescriptlang.org/docs/), [6.0.3 registry](https://registry.npmjs.org/typescript/6.0.3). latest 7.0.2는 확인했으나 typescript-eslint 8.71.0의 지원 범위 `>=4.8.4 <6.1.0` 밖이라 선택하지 않음. |
| Zod | 4.6.5 | [registry](https://registry.npmjs.org/zod/latest). 로컬 기록/복원 파일의 구조·날짜·콘텐츠 버전 검증. |
| ESLint / typescript-eslint | 10.12.0 / 8.71.0 | npm 안정 태그, 상호 peer 범위 확인. React hooks 7.1.1, refresh 0.5.7. |
| Vitest | 5.0.3 | 날짜·복습·영속성과 콘텐츠 구조를 DOM 없이 검증. |
| Playwright | 1.63.0 | Chromium/WebKit, 데스크톱·모바일 실제 렌더링/음성·녹음 동선 검증. |

런타임: 이 Mac Node 24.2.0, npm 11.3.0, macOS 27.0.1. 시스템/전역 도구 업그레이드 안 함. `@types/node`는 런타임에 맞게 24.19.1 선택. 처음 설치 audit: 취약점 0(시점 결과, 미래 보장 아님).

CSS/내장 SVG/시스템 폰트 사용. CSS 라이브러리, 라우터, 상태 라이브러리, 백엔드, DB, 인증 없이 작은 경계를 유지한다. 순수 모델 함수 + React 화면, hash 라우팅, localStorage + 직전 백업, Cache API/서비스 워커. 외부 CDN/폰트/추적 없음.

음성은 same-origin WAV `FileAudioAdapter`, 녹음은 [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) 및 getUserMedia. 파일 재생은 브라우저 합성음성 목록/네트워크 STT에 의존하지 않는다. MediaRecorder MIME은 webm/opus → mp4 → webm의 지원 여부를 확인하고 선택한다. 발음 평가는 없음. 외부 provider는 interface까지만 제공; 연결·키·비용/서버 설정은 별도 승인된 후속 작업.

서비스 워커는 전체 화면·음성 캐시 성공 + 실제 제어 확인 후에만 준비됨을 표시한다. 캐시는 `my-en-` 접두사에 한정해 정리. 빌드 자산 해시로 버전 분리. 기존 탭의 공부를 강제로 끊는 skipWaiting 자동 활성화 없음.
