# 릴리스 체크리스트 — miniapp-template

## 사전 확인

- [ ] package.json version이 올바른 SemVer 형식이다 (MAJOR.MINOR.PATCH).
- [ ] app.config.json templateVersion이 갱신되었다.
- [ ] 변경 내용이 릴리스 종류(major/minor/patch)에 맞는다.

## 빌드 검증

- [ ] `npm ci` 통과
- [ ] `npm run check` 통과 (config + verify:dist)
- [ ] `npm run test:unit` 통과
- [ ] `npm run build -- --env=production` 통과
- [ ] `npm run verify:dist` 통과
- [ ] `npm run test:e2e` 통과 (Desktop/Mobile Chromium)

## 배포 검증

- [ ] CI가 main push에서 통과
- [ ] dev Pages 배포 확인
- [ ] preview 대상이 올바르게 배포됨
- [ ] smoke 검사 통과

## 운영 승격 (수동)

- [ ] PROMOTE 입력 확인
- [ ] production Environment 승인 확인
- [ ] 검증 재수행 통과
- [ ] 운영 저장소 전달 완료
- [ ] 운영 smoke 성공
- [ ] 실제 운영 URL에서 정상 동작 확인

## 실기기 확인 (필수)

- [ ] Android 실기기에서 PWA 설치 및 동작 확인
- [ ] iPhone/iPad에서 Safari 홈 화면 추가 확인
- [ ] 오프라인 동작 확인
- [ ] 업데이트 후 사용자 데이터 보존 확인

## 릴리스 기록

- [ ] GitHub Release 생성 (태그 + 메모)
- [ ] 릴리스 artifact 첨부 (rollback용)
- [ ] docs/agent.md 갱신
