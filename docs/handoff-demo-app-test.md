# 인수인계 — demo-app-test 실증 (새 세션용 요청문)

작성: 2026-11-03, 템플릿 브랜치 `arena/11443e40-miniapp-template` (해당 브랜치 최신 커밋)
용도: 세션 저장소를 `zzexxous-pixel/demo-app-test` 로 전환한 새 세션에 그대로 붙여넣는 요청문.

---

## 붙여넣을 요청문

```
저장소: zzexxous-pixel/demo-app-test (main). miniapp-template의 "다음 단계" 중
demo-app-test 실증을 이어서 진행해줘. 시드 push부터 시작.

[현재 상태]
- 템플릿 저장소 zzexxous-pixel/miniapp-template 은 public. 직전 세션이 브랜치
  arena/11443e40-miniapp-template 최신 커밋에 시드 도구(scripts/seed.mjs, npm run seed)와
  문서·인수인계문을 푸시해 뒀다.
- 아래 클론 명령의 브랜치명은 arena/11443e40-miniapp-template 이다 (숫자 11443e40).
- demo-app-test 는 아직 앱 내용이 없다 (README base 커밋만 있음).
  Pages Source=GitHub Actions 는 이미 켜져 있다 (build_type=workflow 확인됨).
- 이 세션의 토큰은 이 저장소(demo-app-test)로만 범위가 정해져 있다.
  다음은 권한이 없어 반드시 403 이므로 시도하지 말 것 (사용자가 직접 설정해야 함):
  repo variable / secret / environment / Pages API 쓰기.
- miniapp-template 은 public 이라 인증 없이 clone 가능하다 (github.com 접근 가능).
- 샌드박스는 github.io 로 직접 curl 불가 → 배포 확인은 워크플로(smoke job) 결과로 검증한다.

[작업 순서]
1. 템플릿 문서 먼저 읽기: 클론한 소스의 docs/agent.md, docs/operations.md
   (특히 "저장소 시드" 절과 "단일 preview 정책").
2. 템플릿 소스 가져오기:
     git clone -b arena/11443e40-miniapp-template --depth 1 \
       https://github.com/zzexxous-pixel/miniapp-template.git /tmp/tpl
3. 이 세션 작업 트리에 복사한다 (.git, node_modules, dist 제외).
   placeholder README 는 삭제하고 커밋한다 (템플릿 README 로 대체).
   app.config.json 은 그대로 둔다 — appId=demo-app, devRepo=demo-app-test, prodRepo=demo-app 로
   이미 이 저장소를 가리킨다.
4. 검증: npm ci → npm run check → npm run test:unit →
   npm run build -- --env=development → npm run verify:dist
5. 시드: npm run seed -- --replace
   - 쓰기 권한을 git push --dry-run 으로 먼저 프로브하고, 통과하면 깨끗한 단일 시드 커밋을
     main 으로 force push 한다 (커밋 메시지에 source-sha·template-version·app-version 기록).
   - 실행 전 main 브랜치 보호 설정이 없는지 확인한다 (있으면 PR 경로로 바꾼다).
   - 403 이 나오면 아무것도 덮어쓰지 말고 즉시 중단·보고한다.
6. main push 로 deploy-dev 가 자동 실행된다. 3개 job(빌드+E2E / Pages 배포 / smoke) 성공 확인:
     gh run list -R zzexxous-pixel/demo-app-test
     gh run view <id> -R zzexxous-pixel/demo-app-test
7. preview 실증(교체):
   - 임시 브랜치 preview/demo-check 에 식별 가능한 변경(예: 헤더 문구)을 커밋·푸시
   - app.config.json 의 preview.defaultRef 를 "preview/demo-check" 로 커밋해 main 에 push
     (variable PREVIEW_REF 는 설정 권한이 없어 이 세션에서 못 만든다 → defaultRef 경로를 쓴다)
   - deploy-dev 가 /preview/ 를 pre 환경으로 재생성하는지 확인:
     site/preview/build-info.json 의 environment=pre, sourceSha=preview 커밋
8. preview 실증(종료): defaultRef 를 "" 로 되돌리는 커밋을 main 에 넣고,
   다음 배포에서 /preview/ 가 사라지는지 확인한다 (단일 슬롯 정책).
9. 마무리: docs/agent.md 에 세션 결과(시드 SHA, 배포 run id, smoke 결과, preview 교체·종료 확인)를
   기록하고 PR 로 남긴다. 사용자에게 남은 수동 설정을 정리해 보고한다:
   production environment + required reviewers 1명, secret DEPLOY_TOKEN(demo-app Contents RW),
   (선택) repo variable PREVIEW_REF.

[주의]
- miniapp-template 으로 push 하지 말 것 (이 세션 토큰 범위 밖). 템플릿 수정이 필요하면 별도 세션.
- 운영 promote 는 이번 범위가 아니다 (production env·DEPLOY_TOKEN 미설정).
- 권한 확인용 프로브로 원격에 커밋을 남기지 말 것. 쓰기 확인은 npm run seed --dry-run 으로 한다.
- 운영 저장소(demo-app)도 이번 범위 아님.
```

---

## 참고: 직전 세션에서 확정한 사실 (새 세션이 같은 시행착오를 반복하지 않도록)

| 항목 | 확정 내용 |
|---|---|
| 세션 토큰 범위 | 세션에서 고른 저장소 1개로 한정. App 설치가 All repositories 여도 세션 밖은 Contents 쓰기 403 |
| App 권한 부재 | Environments · Pages · Secrets · Variables 는 Arena App 권한에 없음 → 사용자 수동 설정 |
| demo-app-test 상태 | 빈 저장소, Pages Source=GitHub Actions ✓, `production` environment 없음 |
| miniapp-template 상태 | public (익명 clone 가능), main `a77ca92`, self-deploy(smoke) 성공 |
| 시드 도구 검증 | 로컬 bare 저장소에서 최초 시드·`--replace` 덮어쓰기 모두 확인, 403 시 중단 확인 |
| 배포 가드 | "최신 커밋 확인" 가드가 오래된 실행의 배포를 실제로 차단함(2026-11-03 관측) |
