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
- PREVIEW_REF repo variable로 preview 대상 명시 (`origin/` 접두어는 자동 제거).
- 대상은 워크트리로 분리 checkout해 빌드하므로 main 워크트리에 영향 없음.
  preview 배포본의 build-info.sourceSha에 preview 커밋이 기록되어 대상을 추적할 수 있다.
- PREVIEW_REF가 비어 있으면 preview 없이 dev만 배포된다 (preview 없음 = 정상 상태).
- main dev 배포는 `/preview/`를 무조건 지우지 않는다: PREVIEW_REF가 있으면 재생성,
  없으면 이전 preview를 배포하지 않는다 (사이트를 통째로 새로 조립하므로 제거됨).
- PR 종료 시: 현재 PREVIEW_REF 대상이면 variable을 비우거나 새 대상으로 교체한다.
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
