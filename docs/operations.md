# 운영 가이드 — miniapp-template

## 워크플로 개요

```
[개발] demo-app-test (main)
    │
    ▼
 ① CI (ci.yml → verify.yml)
    ├─ config 검증 / unit 테스트 / production 빌드 / dist 검사
    ├─ 검증된 dist artifact를 그대로 대상 E2E (Desktop/Mobile Chromium)
    └─ ✅ 통과 → 개발 Pages 배포 (deploy-dev.yml)
    │
    ▼
 ② deploy-dev.yml (main push)
    ├─ development 빌드(dist) → 동일 dist E2E·검사
    ├─ PREVIEW_REF 지정 시 preview 빌드를 worktree로 분리 생성해 /preview/에 조립
    ├─ 배포 직전 최신 커밋 확인 (오래된 queued 실행의 덮어쓰기 방지)
    └─ 루트+preview 한 번에 배포 → smoke

 ③ Promote to Production (promote.yml)  ← 수동 실행
    ├─ PROMOTE 입력 + devRepo/main 브랜치 제한
    ├─ production Environment 승인
    ├─ verify 재실행 → 산출물 sourceSha·environment 확인
    ├─ 검증된 dist → 운영 저장소 main에 push (히스토리 유지, force push 없음)
    ├─ GitHub Release v{version} + dist zip 첨부 (롤백 보관)
    └─ 운영 smoke (EXPECTED_SHA·EXPECTED_ENV=production)
    │
    ▼
 [운영] demo-app → GitHub Pages
```

## 템플릿 저장소 자체 (miniapp-template)

- Pages Source = **GitHub Actions**로 켜 둔다. main push마다 deploy-dev가 실행되어
  템플릿 자신의 배포 흐름(build→E2E→Pages→smoke)을 실전 검증한다.
  → 사이트: https://zzexxous-pixel.github.io/miniapp-template/ (dev 배지 표시)
- 이 저장소에서는 promote가 실행되지 않는다(devRepo 제한). Release·롤백 실증은 demo-app-test에서.

## 저장소 시드 (빈 개발 저장소에 최초 1회)

템플릿 내용을 새 개발 저장소(`demo-app-test`)로 옮기는 절차. `npm run seed`가 담당한다.

원칙:

- 대상은 `app.config.json`의 `devRepo`와 일치해야 한다 (운영·템플릿 저장소로의 시드 사고 방지).
- 커밋된 상태의 tree만 옮긴다 — 작업 트리가 더러우면 중단하고, 작업 트리·index는 건드리지 않는다.
- 대상 저장소에 이미 `main`이 있으면 거부한다. 시드는 **빈 저장소 최초 1회** 전용이다.
- 시드 커밋 메시지에 `source-repo`·`source-sha`·`template-version`·`app-version`을 기록한다.
  앱 저장소 히스토리는 시드 커밋에서 시작한다(템플릿 히스토리를 끌고 가지 않음).

절차:

1. `npm run seed -- --dry-run`
   원격 상태 확인 + **쓰기 권한 프로브**(실제 푸시와 동일한 인증 경로로 `git push --dry-run`).
   403이면 아무것도 쓰지 않고 원인·조치를 출력하고 중단한다.
2. `npm run seed`
   시드 커밋 생성 → `refs/heads/main` 푸시. 이후 main push이므로 `deploy-dev`가 자동 실행된다
   (워크플로 파일도 함께 시드되므로 별도 활성화 불필요).
3. 결과 확인: `gh run list -R <devRepo> -L 5`
4. 이후 갱신은 일반 main push/PR로만 한다. 재시드는 `--replace`(파괴적, 히스토리 소실)이며
   정말 필요할 때만 쓴다.

agent 토큰이 대상 저장소에 접근할 수 없으면 시드가 쓰기 프로브 단계에서 실패한다.
그때는 사용자가 Arena의 GitHub 연결에 해당 저장소 권한을 추가해야 한다.

## 최초 설정 체크리스트 (저장소마다 1회)

개발 저장소(demo-app-test):

- [ ] GitHub Pages Source = **GitHub Actions** (Deploy from a branch 아님)
- [ ] Actions general permissions: read-only (workflow별로 선언하므로 충분)
- [ ] repository variable `PREVIEW_REF` = preview 대상 브랜치 (예: `arena/xxx`)
- [ ] environment `production` 생성 + **required reviewers** 사용자 1명 지정
      (Environment 만들기만 하고 approver를 안 걸면 승인 보호가 없다 — 반드시 확인)
- [ ] secret `DEPLOY_TOKEN` = 운영 저장소 전용 fine-grained PAT
      (Repository access: demo-app 1개, Permissions: Contents Read and write)
      — token 값은 어디에도 출력·커밋하지 않는다.

운영 저장소(demo-app, 산출물 전용):

- [ ] GitHub Pages Source = **Deploy from a branch** → `main` / `/ (root)`
- [ ] `.nojekyll`이 산출물에 포함되므로 Jekyll 처리 우려 없음 (빌드가 포함 여부 검사)
- [ ] 브랜치 보호 설정 시 Actions bot(또는 DEPLOY_TOKEN 사용자)의 main push 허용

## 단일 preview 정책

- preview는 하나만 유지한다.
- 대상 선택 순서: repo variable `PREVIEW_REF` → 비어 있으면 `app.config.json` 의 `preview.defaultRef` → 둘 다 없으면 preview 없이 배포.
  (`origin/` 접두어는 자동 제거. variable 은 임시 대상 지정·긴급 제거용, defaultRef 는 저장소에 커밋되는 상시 대상)
- variable 변경은 저장소 설정 권한이 필요하지만 `preview.defaultRef` 는 커밋으로 지정된다.
  → 저장소 설정 권한이 없는 주체(agent·CI)만으로도 preview 실증이 가능하다.
    preview 브랜치를 만들고 defaultRef 를 그 브랜치로 커밋 → main 병합 → 다음 dev 배포에서 재생성.
  실증 종료 시 defaultRef 를 `''` 로 되돌리는 커밋을 올린다.
- 대상은 워크트리로 분리 checkout해 빌드하므로 main 워크트리에 영향 없음.
  preview 배포본의 build-info.sourceSha에 preview 커밋이 기록되어 대상을 추적할 수 있다.
- PREVIEW_REF가 비어 있으면 preview 없이 dev만 배포된다 (preview 없음 = 정상 상태).
- main dev 배포는 `/preview/`를 무조건 지우지 않는다: 대상(variable 또는 defaultRef)이 있으면
  매 배포마다 그 대상으로 preview를 재생성해 유지하고, 대상이 없으면 이전 preview를 배포하지 않는다
  (사이트를 통째로 새로 조립하므로 제거됨).
- PR 종료 시: 대상이 그 PR 브랜치면 variable을 비우거나(임시 지정이었을 때) defaultRef를 새 대상/`''`로 되돌리는 커밋을 올린다.
  PR 종료 자체가 배포를 지우지는 않는다 — 다음 main 배포부터 반영된다 (단일 슬롯 정책).
- Arena 브랜치명은 어디에도 하드코딩하지 않는다.

## 환경 구분

| 환경 | 환경 표시 | 설치 이름 | 링크 manifest | 캐시 접두사 |
|---|---|---|---|---|
| preview | pre | demo-app pre | manifest-pre.webmanifest | demo-app-pre- |
| development | dev | demo-app dev | manifest-dev.webmanifest | demo-app-dev- |
| production | (없음) | demo-app | manifest.webmanifest | demo-app-prod- |

- SW activate는 **같은 앱·같은 환경** 접두사의 이전 캐시만 삭제한다.
  동일 origin의 다른 앱·다른 환경 캐시는 건드리지 않는다.
- localStorage는 origin 공유를 감안해 `{appId}:` 키 prefix를 사용한다.

## 릴리스 절차

1. 개발 및 preview 확인
2. 릴리스 종류 선택 (major/minor/patch)
3. package.json version 갱신 PR
4. 검증 후 main 병합
5. dev 확인
6. 운영 수동 승격 (promote.yml 실행, PROMOTE 입력, production 승인)
7. 운영 smoke 성공
8. 릴리스 태그·GitHub Release 확인 (promote가 자동 생성)

규칙: 재시도로 버전을 올리지 않는다. 공개된 버전(vX.Y.Z 태그)은 다른 내용으로 재출시하지 않는다
(promote가 태그 충돌을 감지해 거부한다). 수정은 새 PATCH 버전.

## 롤백

운영 파일만 문제이고 사용자 데이터는 호환인 경우:

1. 개발 저장소 Releases에서 직전 정상 `vX.Y.Z` 릴리스의 `{app}-vX.Y.Z-dist.zip` 다운로드
2. 운영 저장소 main에 동일 파일 재배치 push (수동 실행 또는 promote의 대상 버전 재지정 불가 → 수동 절차)
   ```bash
   unzip -o <app>-vX.Y.Z-dist.zip -d prod-rollback && cd prod-rollback
   git init -b main && git remote add origin <prod-repo-url>
   git add -A && git commit -m "rollback: redeploy vX.Y.Z" 
   # 기존 main 히스토리를 유지하려면 clone 후 파일 교체 커밋을 사용한다.
   git push --force-with-lease origin main   # 산출물 전용 저장소에서만 허용 (최후 수단)
   ```
3. Pages 배포 완료 후 smoke:
   `SMOKE_URL=<prodUrl> node scripts/smoke.mjs` (EXPECTED_SHA/EXPECTED_ENV 없이 빌드 자체 확인)
4. 앱 파일 롤백은 localStorage/IndexedDB를 복원하지 않는다. 저장 형식이 호환인지 확인 후 진행.
5. Rollback도 운영 저장소 히스토리에 커밋으로 남는다 (이력 추적 가능).

Artifact retention(7일)이 지난 릴리스는 GitHub Release 첨부(zip)가 장기 보관소다.
