# miniapp-template

미니 웹 앱 개발·테스트·배포·운영 템플릿.

정적 HTML/CSS/JavaScript 미니 앱에 적합하며, npm과 GitHub Actions를 사용한다.
GitHub Pages 기반 운영을 지원한다.

## 빠른 시작

```bash
npm ci
npm run init -- --app-id=my-app --short-name="내 앱" --dev-repo=owner/my-app-test --prod-repo=owner/my-app
```

## 기본 명령

| 명령 | 설명 |
|---|---|
| `npm run check` | config 검증 (빌드 후 `verify:dist` 별도 실행) |
| `npm run test:unit` | 단위 테스트 |
| `npm run build -- --env=production` | production 빌드 |
| `npm run build -- --env=development` | development 빌드 |
| `npm run build -- --env=preview` | preview 빌드 |
| `npm run test:e2e` | Playwright E2E (Desktop/Mobile Chromium) |
| `npm run serve` | 로컬 정적 서버 |
| `npm run test:smoke` | 배포 후 smoke |

## 환경

| 환경 | 환경 표시 | 설치 이름 |
|---|---|---|
| preview | pre | demo-app pre |
| development | dev | demo-app dev |
| production | (없음) | demo-app |

## 구조

- `app.config.json` — 앱 설정
- `package.json` — 앱 버전 원본
- `scripts/` — 빌드·검증·smoke·서빙·초기화
- `src/` — 예제 앱
- `tests/` — unit + e2e
- `.github/workflows/` — CI, verify, dev 배포, 운영 승격
- `docs/` — 운영 문서, 릴리스 체크리스트, 템플릿 업그레이드 안내

## 문서

- `docs/operations.md` — 운영 가이드
- `docs/release-checklist.md` — 릴리스 체크리스트
- `docs/template-upgrade.md` — 템플릿 업그레이드 안내
- `docs/agent.md` — agent 인수인계
