# Agent handoff — miniapp-template

최종 갱신: 2026-11-03. 다음 세션은 이 문서를 먼저 읽고, 변경·검증·배포 결과와 새 결정을 계속 갱신한다.

## 프로젝트 개요

- 정적 HTML/CSS/JavaScript 미니 앱 템플릿
- npm + GitHub Actions + GitHub Pages 기반
- 개발자는 한 명, preview는 하나만 유지
- 운영 배포는 수동 승인

## 세션 기록

### 2026-11-03 (현재 세션) — demo-app-test 실증 착수: 쓰기 프로브에서 권한 차단 확인

사용자 지시: "다음 단계"의 demo-app-test 실증을 이어가되, 먼저 쓰기 프로브 → 시드 push.

1. **현황 확인** — `demo-app-test`·`demo-app` 저장소는 사용자가 이미 생성(2026-11-03 06:18 UTC).
   - `demo-app-test`: 빈 저장소(브랜치 0개), Pages `build_type=workflow` ✓ (Source=GitHub Actions 이미 설정됨)
   - environment는 `github-pages`만 존재 → `production`(required reviewers) 미생성
   - repo variable·secret 에는 접근 자체가 불가(아래 403) — PREVIEW_REF·DEPLOY_TOKEN 미확인
2. **쓰기 프로브 결과: 전부 차단(403)** — 원인은 agent 토큰이 `miniapp-template` 1개 저장소에만
   설치되어 있기 때문(fine-grained / GitHub App 설치 범위). 즉 코드 문제가 아니라 **연결 권한 문제**.
   | 프로브 | 명령 | 결과 |
   |---|---|---|
   | git push | `git push origin probe/write-test` | `Permission to ... denied` 403 |
   | Contents API | `PUT /repos/.../contents/PROBE.md` | `Resource not accessible by integration` 403 |
   | Actions variables | `POST .../actions/variables` | 403 (miniapp-template에서도 403) |
   | Environments 쓰기 | `PUT .../environments/production` | 403 |
   | Secrets 쓰기 | `PUT .../actions/secrets/*` | 403 |
   | 읽기(공개 저장소 메타·Pages·environments) | `GET ...` | 정상 (공개 정보라 인증 없이도 조회됨) |
   → 시드 push는 실행하지 않았다. 실패한 프로브가 만든 부산물은 없다(빈 저장소 그대로, main 없음).
### 2차 프로브 (2026-11-03, 사용자가 App 설치를 All repositories + RW 로 재연결한 뒤)

결과: **여전히 demo-app-test 쓰기 403.** 원인 규명을 위해 miniapp-template(권한 보유)을 대조군으로
같은 API를 호출했다.

| API | miniapp-template (세션 저장소) | demo-app-test (범위 밖) |
|---|---|---|
| Contents 쓰기 (`PUT /contents/...`) | **200 성공** | 403 (integration) |
| Environments 쓰기 (`PUT /environments/...`) | 403 | 403 |
| Pages 쓰기 (`POST /pages`) | 403 | 403 |
| Actions variables 쓰기 | 403 | 403 |
| git push | 성공 | 403 Permission denied |

해석(중요):

1. **세션 토큰은 App 설치 토큰 전체가 아니라 "세션 선택 저장소"로 범위가 좁혀진 토큰**이다.
   설치 설정이 All repositories 여도 세션 저장소 밖은 Contents 쓰기조차 불가(403 integration).
   → App 설치 화면에서 더 줄 권한은 없다. 범위는 **세션의 저장소 선택**이 정한다.
2. **Environments·Pages·Secrets·Variables 권한은 Arena App 에 아예 없다**
   (권한 요약: actions·code·issues·pull requests·repository hooks·workflows 만 Read/Write).
   → `production` environment+reviewer, `DEPLOY_TOKEN`, `PREVIEW_REF` variable, Pages 켜기는
     **범위 문제가 아니라 권한 문제**이므로 사용자가 저장소 설정에서 직접 해야 한다.
     (Pages 켜기는 demo-app-test·miniapp-template 모두 이미 완료 상태)

부수 정리: 대조군 Contents 쓰기가 **main 에 실제 커밋을 만들었다**(`dfb9f4b` "probe", PROBE2.md).
즉시 삭제 커밋(`a77ca92`)으로 되돌렸다. main 히스토리에 프로브 커밋 2개가 남았고(강제 푸시로
지우지 않음 — 소스 force push 금지 원칙), 이로 인한 deploy-dev 재실행은 정상 흐름으로 둔다.

3. **시드 도구 추가** — `scripts/seed.mjs` + `npm run seed`
   - 커밋된 tree만 이동(작업 트리·index 무변경), 더러운 트리면 중단
   - `app.config.json` devRepo ≠ 대상이면 거부, 원격 main이 이미 있으면 거부(`--replace`만 허용)
   - 푸시 전 `git push --dry-run`으로 **쓰기 권한을 먼저 프로브** → 403이면 원인·조치 출력 후 중단
   - `--remote=` 로 전송 URL 교체 가능(로컬 bare 저장소로 성공 경로 검증용)
   - 검증: 로컬 bare 저장소에 시드 성공(35개 파일, 시드 커밋 1개, source-sha 기록) /
     실제 대상 `demo-app-test`에서는 설계대로 쓰기 프로브 단계에서 403으로 중단
4. **문서** — operations.md에 "저장소 시드" 절차 추가, 단일 preview 정책에
   "variable 변경은 설정 권한 필요 / `preview.defaultRef`는 커밋으로 지정 → 에이전트만으로 preview 실증 가능" 보강.

### 진행을 막고 있는 것 (사용자 조치 필요) — 2차 프로브로 원인 확정

- **데모 저장소 쓰기**: App 설치(All repositories)로는 해결되지 않는다. 세션 토큰이 세션 저장소로
  좁혀지므로, demo-app-test 실증은 **세션 저장소를 demo-app-test 로 전환**해야 시작된다.
  (빈 저장소라 base 커밋이 필요 → GitHub 웹에서 README 1개 추가 후 전환. 이후 `npm run seed --replace`로
  깨끗한 시드 커밋을 main 에 올리고, 그 전환 세션에서 dev/preview 실증을 이어간다.)
- **저장소 설정(권한 자체가 없음)**: `production` environment + required reviewers, secret `DEPLOY_TOKEN`,
  (선택) repo variable `PREVIEW_REF`. App 권한에 Environments/Pages/Secrets/Variables 가 없어
  에이전트가 대신할 수 없다 → 사용자 직접 설정.
- 위 연결이 열리면 에이전트가 바로 할 수 있는 것: `npm run seed` → main push → deploy-dev 실행 확인
  → `gh run list`/smoke 결과 확인 → preview 브랜치 + `preview.defaultRef` 커밋으로 preview 교체·종료 실증.
- 사용자만 할 수 있는 것(설정 화면 필요): `production` environment + required reviewers 1명,
  secret `DEPLOY_TOKEN`(demo-app Contents RW), (선택) repo variable `PREVIEW_REF`.
  Pages Source는 `demo-app-test`·`miniapp-template` 모두 이미 Actions로 확인됨.

### 2026-11-01 (이전 세션, 오류로 유실 → 패치로 복구)

- v1 템플릿 구조·스크립트·워크플로·예제 앱·테스트·문서 구현.
- 로컬 빌드 검증 진행 중 중단. PR 없음.
- Arena 패치 파일(`01a194db-…c51c.patch`)과 인계서(`miniapp-template-handoff.md`)를
  Google Drive `arena/` 폴더에서 내려받아 34개 파일 전부 복원.
- 패치에 binary diff가 없어 유실된 아이콘 3종은 체크리스트 모티프 PNG로 재생성
  (`src/assets/icon-192.png` 192×192, `icon-512.png` 512×512, `apple-touch-icon.png` 180×180).

### 2026-11-02 (이전 세션) — 복원 후 결함 수정·검증 완료

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
| `scripts/seed.mjs` | 빈 개발 저장소 시드 (tree만 이동·대상 검증·쓰기 프로브 후 push) |
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

- 현재 작업 브랜치: `arena/11443e40-miniapp-template`
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
npm run seed -- --dry-run   # 빈 개발 저장소 시드 사전 검사 + 쓰기 권한 프로브
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

## 확인 상태 (2026-11-03)

- demo-app-test / demo-app 저장소 생성 확인 (사용자 수행).
- demo-app-test: 빈 저장소, Pages build_type=workflow ✓, environment `production` 없음.
- 시드 도구 로컬 검증: 로컬 bare 저장소에 35개 파일 시드 성공, 시드 커밋 1개, source-sha 기록 확인.
- demo-app-test 실 쓰기: git push·Contents·variables·environments·secrets 모두 403 (연결 권한 범위 밖).

### 결정: 템플릿 저장소(self)에도 Pages 켜기 (2026-11-02) — 실행 완료

- 목적: main push마다 deploy-dev(build→E2E→Pages→smoke)가 템플릿 자기 자신을 검증.
- 운영 승격은 계속 차단됨: promote.yml의 devRepo(demo-app-test) 제한 때문.
- 사용자 승인 후 진행: Pages Source=GitHub Actions UI 활성화(2026-11-02, agent 토큰에 Pages scope 없음)
  → **PR #1 병합(merge commit)** → main 첫 self-deploy 전 과정 성공:
  - 빌드 및 조립 ✓ (dev dist 대상 E2E 16개 통과 포함)
  - Pages 배포 ✓ ("최신 커밋 확인" 가드 포함, site=dev+preview 조립 1회 배포)
  - 배포 후 smoke ✓ (실제 Pages URL 대상, 8s — 전파 지연 없이 즉시 통과)
  - CI(run 41535264826) ✓ 병렬 통과
  - 라이브: https://zzexxous-pixel.github.io/miniapp-template/ (dev 배지·dev 설치 이름)
  - PREVIEW_REF 미설정 → /preview/ 없음(정상 상태). preview 교체 실증은 demo-app-test에서.

## 다음 단계

1. (완료 2026-11-02) PR #1 병합 + 템플릿 저장소 첫 self-deploy(smoke 포함) 성공.
2. demo-app-test 실증 — **쓰기 프로브에서 403 차단, 사용자 연결 권한 대기 중 (2026-11-03)**.
   - (완료) 저장소 생성 확인, Pages Source=GitHub Actions 확인, 쓰기 프로브 5종, 시드 도구(`npm run seed`) 준비.
   - (대기) Arena GitHub 연결에 demo-app-test/demo-app 권한 추가 → 그 즉시 `npm run seed` → main push.
   - (대기) deploy-dev 자동 실행·smoke 확인 → preview 브랜치 + `preview.defaultRef` 커밋으로 교체/종료 실증.
   - (사용자 설정) `production` environment + required reviewer 1명, secret `DEPLOY_TOKEN`,
     (선택) repo variable `PREVIEW_REF`.
   - (이후) demo-app Pages main/(root) 확인 → promote 실행 → smoke·Release·롤백(zip) 실증.
3. 예제 검증 완료 후 기존 한자·하트튠 적용 계획 수립 (별도 승인).

주의: agent 샌드박스는 github.io로 직접 curl 불가(네트워크 allowlist) — 라이브 URL 확인은
workflow의 smoke job 결과로 검증한다.
