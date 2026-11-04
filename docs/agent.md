# miniapp-template 에이전트 가이드 (최종)

이 문서는 `miniapp-template`을 기반으로 새 미니 앱을 생성·개발·배포·운영할 때 에이전트가 참고하는 최종 가이드입니다.
세션별 실증 기록(run ID, 커밋 SHA, 단계별 실행 내역)은 포함하지 않습니다.

---

## 1. 프로젝트 개요

- 정적 HTML/CSS/JavaScript 미니 앱 템플릿 (예제 앱: PWA 체크리스트)
- npm + GitHub Actions + GitHub Pages 기반
- 개발자 1명, preview는 하나만 유지 (단일 preview 슬롯 정책)
- 운영 배포는 수동 승인 (promote.yml 수동 실행 + production Environment 승인)

---

## 2. 작업 원칙

- 템플릿으로 새 미니 앱을 생성하고, 공통 개발·테스트·배포·운영 체계를 제공한다.
- 환경은 명시적 빌드 입력으로 지정한다 (`--env=preview|development|production` 또는 `APP_ENV`).
- 미지정·잘못된 환경은 조용히 운영으로 처리하지 않고 **빌드 오류**로 다룬다.
- 환경 배지 색상은 분홍색 고정이 아니다. 헤더 바탕색과 대비되는 가시성 좋은 색 (기본: 아몬드).
- 단일 preview 정책: repo variable `PREVIEW_REF`로 대상 브랜치를 명시한다.
- 운영 이관 = 검증된 artifact 전달 방식 (소스 force push 금지).
- 앱 버전 = `package.json`의 `version` (한 곳에서 관리).
- 템플릿 버전 = `app.config.json`의 `templateVersion`.

---

## 3. 구조 (파일 책임 요약)

| 파일 | 책임 |
|---|---|
| `app.config.json` | 앱 설정 (이름·저장소·URL·preview 정책·템플릿 버전) |
| `package.json` | 앱 버전 원본 + 스크립트 |
| `scripts/build.mjs` | 환경별 빌드 (manifest 링크·배지·버전·환경 suffix·캐시명·해시 주입·검증) |
| `scripts/verify-dist.mjs` | dist 산출물 검사 (allowlist·누락·참조·placeholder·격리 접두사) |
| `scripts/smoke.mjs` | 배포 후 HTTP smoke (config 기반 앱명·마커·manifest 검사) |
| `scripts/serve.mjs` | 정적 서버 (로컬/E2E용, `node scripts/serve.mjs [port] [dir]`) |
| `scripts/init-project.mjs` | 템플릿 초기화 (app.config.json 생성) |
| `scripts/seed.mjs` | 빈 개발 저장소 시드 (작성된 tree를 devRepo로 최초 1회 전송, --dry-run로 사전 검사) |
| `scripts/validate-config.mjs` | app.config.json 검증 |
| `src/` | 예제 앱 (체크리스트·테마·앱 정보·설치 버튼·PWA) |
| `tests/unit/` | 환경·버전·manifest·config·빌드 단위 테스트 (13개) |
| `tests/e2e/` | Playwright E2E (dist 대상) |
| `.github/workflows/ci.yml` | push/PR → verify 호출 |
| `.github/workflows/verify.yml` | 재사용 검증 (빌드+dist artifact → 동일 artifact E2E) |
| `.github/workflows/deploy-dev.yml` | main push → dev dist 검증·E2E → preview 조립 → Pages 1회 배포 → smoke |
| `.github/workflows/promote.yml` | 수동 운영 승격 (PROMOTE·main 제한·Release+tag·운영 smoke) |
| `docs/operations.md` | 운영 가이드 (최초 설정·단일 preview·릴리스·롤백) |
| `docs/release-checklist.md` | 릴리스 체크리스트 |
| `docs/template-upgrade.md` | 템플릿 업그레이드 안내 |

---

## 4. 빌드 / 테스트 / 배포 원칙

**흐름:** 빌드 → 산출물 검사 → 해당 산출물 E2E → artifact 보관 → 같은 산출물 배포

**환경별 빌드:**

| 환경 | 환경 표시 | 설치 이름 | 링크 manifest | 캐시 접두사 |
|---|---|---|---|---|
| preview | pre | `{shortName} pre` | `manifest-pre.webmanifest` | `{appId}-pre-` |
| development | dev | `{shortName} dev` | `manifest-dev.webmanifest` | `{appId}-dev-` |
| production | (표시 없음) | `{shortName}` | `manifest.webmanifest` | `{appId}-prod-` |

- SW 활성화 시 **같은 앱·같은 환경** 접두사의 이전 캐시만 삭제한다. 다른 환경(dev/pre/prod)이나 다른 앱의 캐시는 건드리지 않는다.
- 빌드 해시 `{appId}-build: {hash}`를 JS/CSS/sw.js에 주입하고, manifest에는 `_build` 필드로 주입 → smoke에서 신/구 버전을 판별한다.
- SW 캐시 이름: `{appId}-{env}-{buildHash}`, 접두사로 같은 앱·환경만 정리한다.
- `npm run check`는 config만 검사한다. `verify:dist`는 dist가 필요하므로 빌드 후 별도로 실행한다.

---

## 5. 실행 방법

```bash
npm ci
npm run check           # config 검증 (verify:dist는 빌드 후 별도 실행)
npm run test:unit       # 단위 테스트 (13개)
npm run build -- --env=production   # 또는 development / preview
npm run verify:dist     # dist 산출물 검사
npm run test:e2e        # Playwright E2E (PW_LOCAL=1이면 serve 자동 실행)
npm run serve           # 로컬 정적 서버 (dist)
npm run test:smoke      # 배포 후 smoke (SMOKE_URL 필수)
npm run seed -- --dry-run   # 빈 개발 저장소 시드 사전 검사 + 쓰기 권한 프로브
npm run seed            # 빈 개발 저장소에 시드 (최초 1회, devRepo 대상)
```

템플릿 초기화 (새 프로젝트):

```bash
npm run init -- --app-id=my-app --short-name="내 앱" \
  --dev-repo=owner/my-app-test --prod-repo=owner/my-app
```

---

## 5.5. 새 프로젝트 생성 시의 예상 흐름

에이전트가 새 미니 앱 프로젝트를 생성할 때 참고할 표준 흐름이다.

1. **템플릿 소스 준비** — `miniapp-template`을 클론하거나 다운로드한다. `.git`, `node_modules`, `dist`는 제외한다.
2. **`app.config.json` 생성** — `npm run init`로 앱별 설정(이름, 저장소, URL, preview 정책 등)을 생성한다. `devRepo`는 개발 저장소(예: `owner/my-app-test`), `prodRepo`는 운영 저장소(예: `owner/my-app`)를 지정한다.
3. **로컬 검증** — `npm ci` → `npm run check` → `npm run test:unit` → `npm run build -- --env=production` → `npm run verify:dist` 순으로 실행해 템플릿이 정상인지 확인한다.
4. **빈 개발 저장소에 시드** — `npm run seed -- --dry-run`로 쓰기 권한과 원격 상태를 사전 검사한 뒤, `npm run seed`로 `devRepo`의 `main`에 최초 1회 시드한다. 시드 커밋 메시지에 `source-sha`, `template-version`, `app-version`이 기록된다.
5. **자동 dev 배포 확인** — `main` push 시 `deploy-dev.yml`이 자동 실행된다. 3개 job(빌드+E2E / Pages 배포 / smoke)이 성공하는지 확인한다.
6. **preview 설정 (선택)** — `PREVIEW_REF` repo variable로 preview 대상 브랜치를 지정하거나, `app.config.json`의 `preview.defaultRef`를 커밋으로 지정한다. 단일 preview 슬롯 정책이다.
7. **운영 승격 (수동)** — `promote.yml`을 수동 실행한다. `PROMOTE` 입력 + `production` Environment 승인이 필요하다. 운영 저장소로 검증된 dist를 전달하고, GitHub Release `vX.Y.Z`를 생성한다.

---

## 5.6. agent가 확인·수행해야 할 것 (권한 및 설정)

템플릿 자체는 코드와 워크플로만 제공한다. 아래 항목은 GitHub 저장소 설정 권한이 필요하므로, **에이전트 대신 사용자가 직접 설정해야 한다** (Arena App에 Environments/Pages/Secrets/Variables 쓰기 권한이 없음).

개발 저장소(`devRepo`):

- [ ] GitHub Pages Source = **GitHub Actions** (Deploy from a branch 아님)
- [ ] Actions general permissions: read-only (workflow별로 선언하므로 충분)
- [ ] repository variable `PREVIEW_REF` = preview 대상 브랜치 (예: `arena/xxx`, 선택)
- [ ] environment `production` 생성 + **required reviewers** 사용자 1명 지정
      (Environment만 만들고 approver를 안 걸면 승인 보호가 없다 — 반드시 확인)
- [ ] secret `DEPLOY_TOKEN` = 운영 저장소 전용 fine-grained PAT
      (Repository access: 운영 저장소 1개, Permissions: Contents Read and write)
      — token 값은 어디에도 출력·커밋하지 않는다.

운영 저장소(`prodRepo`, 산출물 전용):

- [ ] GitHub Pages Source = **Deploy from a branch** → `main` / `/ (root)`
- [ ] `.nojekyll`이 산출물에 포함되므로 Jekyll 처리 우려 없음 (빌드가 포함 여부 검사)
- [ ] 브랜치 보호 설정 시 Actions bot(또는 `DEPLOY_TOKEN` 사용자)의 `main` push 허용

---

## 6. 주요 결정

- **템플릿 저장소(self)에도 Pages 활성화:** main push마다 deploy-dev(build→E2E→Pages→smoke)가 템플릿 자기 자신을 검증한다. 운영 승격은 promote.yml의 devRepo 제한으로 이 저장소에서는 실행되지 않는다.
- **preview 대상 선택 순서:** repo variable `PREVIEW_REF` → `app.config.json`의 `preview.defaultRef` → 둘 다 없으면 preview 없이 배포. `origin/` 접두어는 자동 제거된다.
- **운영 이관:** promote.yml 수동 실행만 (PROMOTE 입력 + production Environment 승인).
- **앱 버전 관리:** `package.json` version이 단일 진실원천이다. 템플릿 업그레이드로 앱 버전을 자동 변경하지 않는다.

---

## 7. 발견된 결함 / gotcha (기록 + 수정)

템플릿을 재사용할 때 참고할 known issues와 조치 사항이다.

### 1. smoke retry 타이밍 (수정 완료)

legacy(브랜치 기반) Pages 빌드가 smoke의 build-info.json 재시도 윈도우(3회·약 20초) 이후에 완료될 수 있어 rerun 시 Pages 이미 built 상태로 통과하는 경우가 있었다.
→ **수정:** `scripts/smoke.mjs`의 `build-info.json` 재시도를 `retries: 3`에서 `retries: 8`(약 40초)로 확대했다.

### 2. environment 대소문자 불일치

워크플로는 `environment: production`(소문자)을 참조한다. GitHub Environments는 대소문자를 구분하므로, 사용자가 "Production"(대문자)로 생성하면 워크플로가 인식하지 못한다. 환경 이름은 워크플로 참조와 일치하게(소문자) 생성한다.

### 3. PREVIEW_REF 값 의미

preview 대상 브랜치명이다. `origin/` 접두어가 자동 제거된다. 비우면 `app.config.json`의 `preview.defaultRef`를 fallback으로 쓴다. 값 변경에는 저장소 설정 권한이 필요하다.

### 4. 샌드박스 네트워크 제한

agent 샌드박스는 github.io로 직접 curl할 수 없다. 라이브 URL 확인은 워크플로의 smoke job 결과로 검증한다.

### 5. GitHub 저장소 설정 권한 (에이전트 불가 → 사용자 직접)

Arena App에는 Environments · Pages · Secrets · Variables 쓰기 권한이 없다. 따라서 아래 항목은 **사용자가 저장소 설정 화면에서 직접 수행해야 한다**:

- `production` Environment + required reviewers 1명
- secret `DEPLOY_TOKEN` (운영 저장소 Contents Read and write)
- repo variable `PREVIEW_REF` (preview 대상 브랜치, 선택)
- GitHub Pages Source = GitHub Actions (개발 저장소) / Deploy from a branch (운영 저장소)

미설정 시 `deploy-dev` 또는 `promote` 워크플로가 403으로 실패하므로, 시드 후 반드시 위 체크리스트를 확인한다.

---

## 8. 검증 절차

템플릿 변경 후 다음 순서로 검증한다.

1. `npm run check` — config 검증
2. `npm run test:unit` — 단위 테스트 13개
3. `npm run build -- --env=production` + `npm run verify:dist` — production 빌드 및 dist 검사
4. `npm run test:e2e` — E2E (로컬은 `PW_LOCAL=1`, CI는 workflow)
5. smoke.mjs 수정 시: 단위 테스트/lint 재확인
6. 필요 시 템플릿 self-deploy 확인 (main push → deploy-dev)

---

## 9. 관련 문서

- `docs/operations.md` — 운영 가이드 (최초 설정·단일 preview 정책·릴리스 절차·롤백)
- `docs/release-checklist.md` — 릴리스 체크리스트
- `docs/template-upgrade.md` — 템플릿 업그레이드 안내
- `README.md` — 빠른 시작 및 기본 명령
