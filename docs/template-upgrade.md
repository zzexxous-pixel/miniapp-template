# 템플릿 업그레이드 안내 — miniapp-template

## 템플릿 버전 관리

- 템플릿 자체 버전: `app.config.json` 의 `templateVersion`
- 각 앱의 적용 템플릿 버전: 빌드 시 build-info.json 에 기록
- 템플릿 변경 내역은 Git 이력으로 추적

## 업그레이드 방법

Template repository에서 복사한 프로젝트는 템플릿 변경을 자동으로 상속하지 않는다.
새 템플릿을 적용하려면:

1. 템플릿 저장소에서 최신 템플릿을 내려받는다.
2. 앱별 설정(`app.config.json`)을 보존한 채 공통 파일을 갱신한다.
3. `npm run check` 로 설정 검증
4. `npm run test:unit` + `npm run test:e2e` 로 검증
5. `npm run build -- --env=production` 로 빌드 확인

## 갱신 시 주의사항

- 앱 버전(`package.json` version)은 템플릿 업그레이드로 자동 변경하지 않는다.
- 사용자 데이터(localStorage)는 앱별 키 prefix로 격리되어 있다.
- SW 캐시 이름이 변경되면 이전 캐시는 자동 삭제된다 (같은 prefix의 이전 캐시만).
- 환경 배지 색상은 `src/style.css`의 `--badge-bg`/`--badge-text` 변수로 조정한다.
