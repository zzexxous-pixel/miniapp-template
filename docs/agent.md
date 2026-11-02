# Agent handoff — miniapp-template

최종 갱신: 2026-11-02. 다음 세션은 이 문서를 먼저 읽고, 변경·검증·배포 결과와 새 결정을 계속 갱신한다.

## 프로젝트 개요

- 정적 HTML/CSS/JavaScript 미니 앱 템플릿
- npm + GitHub Actions + GitHub Pages 기반
- 개발자는 한 명, preview는 하나만 유지
- 운영 배포는 수동 승인

## 세션 기록

### 2026-11-01 (이전 세션, 오류로 유실 → 패치로 복구)

- v1 템플릿 구조·스크립트·워크플로·예제 앱·테스트·문서 구현.
- 로컬 빌드 검증 진행 중 중단. PR 없음.
- Arena 패치 파일(`01a194db-…c51c.patch`)과 인계서(`miniapp-template-handoff.md`)를
  Google Drive `arena/` 폴더에서 내려받아 34개 파일 전부 복원.
- 패치에 binary diff가 없어 유실된 아이콘 3종은 체크리스트 모티프 PNG로 재생성
  (`src/assets/icon-192.png` 192×192, `icon-512.png` 512×512, `apple-touch-icon.png` 180×180).

### 2026-11-02 (현재 세션) — 복원 후 결함 수정·검증 완료

복원한 코드에서 실제 결함을 찾아 수정했다:

1. **SW 미등록** — `src/app.js`에 `navigator.serviceWorker.register` 추가.
   상대 URL 등록(Pages 하위 경로·preview 경로에서 자기 디렉터리 scope), `updateViaCache:'none'`,
   탭 복귀(visibilitychange) 시 업데이트 검사.
2. **환경별 설치 이름 미동작** — 빌드가 HTML의 `<link rel="manifest">`를 건드리지 않아
   dev/preview에서도 운영 manifest(demo-app)가 설치 이름으로 쓰임.
   `scripts/build.mjs`가 환경별 manifest 링크(`manifest-dev/pre.webmanifest`)로 치환.
3. **캐시 격리 미흡** — sw.js의 `CACHE_PREFIX`가 `'demo-app-'` 하드코딩이라
   preview SW가 dev 캐시까지 삭제 가능했고 앱별 값이 공통 코드에 고정됨.
   → `{{CACHE_PREFIX}}` placeholder화, 빌드가 `'{appId}-{env}-'`(환경까지 포함)로 주입.
   activate 정리 범위는 같은 앱·같은 환경의 이전 빌드로 한정.
4. **sw.js 자기 자신 precache 제거** — 빌드가 precache 목록에서 `sw.js`·`.nojekyll` 제외.
5. **푸터 버전 형식** — `demo-app vX.Y.Z dev` 형식(인계서 §13)으로 `v` 접두사와
   `{{ENV_SUFFIX}}`를 index.html에 추가하고 빌드가 치환.
6. **공통 스크립트의 demo-app 하드코딩 제거** —
   빌드 마커를 `{appId}-build:`으로, smoke/verify-dist가 app.config.json의 appId·shortName 사용.
7. **`deploy-dev.yml` 재구성** —
   - dev 빌드를 `dist/`에 생성 → E2E·verify:dist가 그 산출물을 대상으로 실행 → `site/`에 조립.
     (기존에는 `site/`에만 빌드해 `dist/` 대상 검사가 반드시 실패하는 상태였음)
   - preview: `PREVIEW_REF`를 fetch 후 **git worktree로 분리 checkout**해 빌드
     (기존에는 fetch만 하고 main 소스로 빌드하는 버그). main 워크트리 무오염.
     sourceSha가 preview 커밋으로 기록됨.
   - deploy 직전 "최신 main 커밋 확인" 가드: 오래된 queued 실행이 최신 배포를 덮어쓰면 실패.
   - smoke job에 checkout 추가 (기존에는 코드 없이 npm run 실행→실패).
8. **`verify.yml`** — e2e job이 dist 없이 실행되던 버그 수정: verify job의 검증된 dist
   artifact를 다운로드해 동일 산출물 대상 E2E. 죽은 `production` input 제거(ci.yml·promote.yml에서).
   요약 job 추가.
9. **`promote.yml` 재구성** —
   - 대상 저장소·URL을 app.config.json에서 로드(하드코딩 제거), devRepo·main 브랜치 제한.
   - PROMOTE 확인 → verify 재실행 → 산출물 sourceSha/environment 검사 →
     운영 저장소 push(기존 main이면 히스토리 유지하며 교체, 없으면 생성. force push 없음) →
     **GitHub Release `vX.Y.Z` 생성 + dist zip 첨부**(롤백 보관) → 운영 smoke(EXPECTED_SHA·EXPECTED_ENV=production).
   - 릴리스 태그가 다른 커밋에 이미 있으면 거부("공개 버전 재출시 금지").
10. **smoke.mjs** — build-info 조회에 재시도 추가(전파 지연), manifest 링크·설치 이름·배지 검사 보강, 오타 수정.
11. 기타: `.gitignore`에 site/·preview-dist/·.preview-src/·google_drive/, 노션 git stderr 소음 제거.

## 사용자 결정 / 작업 원칙

- 템플릿으로 새 미니 앱을 생성하고, 공통 개발·테스트·배포·운영 체계를 제공한다.
- 환경은 명시적 빌드 입력으로 지정한다 (`--env=preview|development|production`).
- 미지정·잘못된 환경은 빌드 오류로 다룬다.
- 환경 배지 색상은 분홍색 고정이 아니다. 헤더 바탕색과 대비 되는 가시성 좋은 색 (기본: 아몬드).
- 단일 preview 정책: PREVIEW_REF repo variable로 대상 명시.
- 운영 이관은 검증된 artifact 전달 방식 (소스 force push 금지).
- 앱 버전은 package.json의 version 한 곳에서 관리한다.
- 템플릿 버전은 app.config.json의 templateVersion에서 관리한다.

## 구조

| 파일 | 책임 |
|---|---|
| `app.config.json` | 앱 설정 (이름·저장소·URL·preview 정책·템플릿 버전) |
| `package.json` | 앱 버전 원본 + 스크립트 |
| `scripts/build.mjs` | 환경별 빌드 (manifest 링크·배지·버전·환경 suffix·캐시명·해시 주입·검증) |
| `scripts/verify-dist.mjs` | dist 산출물 검사 (allowlist·누락·참조·placeholder·격리 접두사) |
| `scripts/smoke.mjs` | 배포 후 HTTP smoke (config 기반 앱명·마커·manifest 검사) |
| `scripts/serve.mjs` | 정적 서버 (로컬/E2E용, `node scripts/serve.mjs [port] [dir]`) |
| `scripts/init-project.mjs` | 템플릿 초기화 (app.config.json 생성) |
| `scripts/validate-config.mjs` | app.config.json 검증 |
| `src/` | 예제 앱 (체크리스트·테마·앱 정보·설치 버튼·PWA) |
| `tests/unit/` | 환경·버전·manifest·config·빌드 단위 테스트 (13개) |
| `tests/e2e/` | Desktop/Mobile Chromium E2E 8시나리오 × 2프로젝트 = 16개 (dist 대상) |
| `.github/workflows/ci.yml` | push/PR → verify 호출 |
| `.github/workflows/verify.yml` | 재사용 검증 (빌드+dist artifact → 동일 artifact E2E) |
| `.github/workflows/deploy-dev.yml` | main push → dev dist 검증·E2E → preview 조립 → Pages 1회 배포 → smoke |
| `.github/workflows/promote.yml` | 수동 운영 승격 (PROMOTE·main 제한·Release+tag·운영 smoke) |

## 브랜치 / 배포

- 현재 작업 브랜치: `arena/9934864f-miniapp-template`
- 템플릿 저장소: https://github.com/zzexxous-pixel/miniapp-template
- 예제 dev 저장소 `demo-app-test` / 운영 `demo-app`은 **아직 미생성** (user approval 필요).
  생성 후 app.config.json의 devRepo/prodRepo·URL은 이미 그 이름을 가정하고 있다.
- dev 배포는 deploy-dev.yml로 main push 시 자동 실행.
- preview 대상은 repo variable PREVIEW_REF로 지정 (예: `arena/xxx` 또는 `origin/arena/xxx`).
- 운영 이관은 promote.yml 수동 실행만. PROMOTE 입력 + production Environment 승인 필요.

## 빌드 / 테스트 / 배포 원칙

- 빌드 → 산출물 검사 → 해당 산출물 E2E → artifact 보관 → 같은 산출물 배포
- 환경별 빌드:
  - production: 환경 표시 없음, 설치 이름 "demo-app", `manifest.webmanifest` 링크
  - development: 표시 "dev", "demo-app dev", `manifest-dev.webmanifest` 링크
  - preview: 표시 "pre", "demo-app pre", `manifest-pre.webmanifest` 링크
- 푸터: `demo-app v{version}` + dev/pre 환경 suffix
- 빌드 해시 `{appId}-build: {hash}` 를 JS/CSS/sw.js에 주입, manifest엔 `_build` → smoke에서 신/구 판별
- SW 캐시 이름: `demo-app-{env}-{buildHash}`, 접두사 `demo-app-{env}-`로 같은 앱·환경만 정리
- `npm run check`는 config만 검사 (verify:dist는 dist 필요 → 빌드 후 별도 실행)

## 실행 방법

```bash
npm ci
npm run check           # config 검증
npm run test:unit       # 단위 테스트 13개
npm run build -- --env=production   # (또는 development/preview)
npm run verify:dist     # dist 산출물 검사
npm run test:e2e        # Playwright E2E (PW_LOCAL=1이면 serve 자동 실행)
npm run serve           # 로컬 정적 서버 (dist)
npm run test:smoke      # 배포 후 smoke (SMOKE_URL 필수)
```

## 확인 상태 (2026-11-02)

- 단위 테스트 13/13 통과
- 3개 환경 빌드 + verify:dist 통과, prod/dev/preview 조립 시뮬레이션에서
  루트·/preview/ smoke 통과 (캐시 접두사 dev/pre 격리 확인)
- 고의 실패 시나리오 확인: 환경 미지정 거부 / 필수 파일 누락 거부 / allowlist 외 파일 거부
- workflow YAML 4개 파싱 통과 (js-yaml)
- **PR #1 CI 통과 (2026-11-02)**: verify + **Playwright E2E 16개(Desktop/Mobile Chromium) 전부 통과** —
  검증된 dist artifact를 그대로 대상으로 실행됨. 샌드박스는 브라우저 다운로드 차단이라
  E2E는 CI로만 확인 가능.
- GitHub 리포 설정(template 여부·Pages·environment·PREVIEW_REF·DEPLOY_TOKEN)과
  demo-app-test/demo-app 생성·실배포는 사용자 승인 대기.
- 참고: miniapp-template 저장소 자체에는 Pages가 없으므로 main 병합 후 deploy-dev의
  Pages 배포 job은 실패한다(예제 실증은 demo-app-test에서). 템플릿 저장소에서
  deploy-dev를 수동 전용으로 바꿀지 Pages를 켜둘지는 사용자 결정 필요.

## 다음 단계

1. 이 브랜치를 push하고 PR → CI에서 E2E 첫 실행 확인.
2. 사용자 승인 후: demo-app-test(비공개 가능) 생성 → main push → Pages Source=GitHub Actions 확인
   → preview 교체/종료 정책 실증 → demo-app(운영) 생성 → Pages main/(root) →
   production environment + required reviewer 설정 → DEPLOY_TOKEN(fine-grained, demo-app Contents RW) 등록
   → promote 실행 → smoke·릴리스·롤백(Release zip) 실증.
3. 예제 검증 완료 후 기존 한자·하트튠 적용 계획 수립 (별도 승인).
