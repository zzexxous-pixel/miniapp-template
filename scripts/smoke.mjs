/**
 * scripts/smoke.mjs
 * 배포 후 HTTP-only smoke: 브라우저 없이 핵심 파일과 build-info 검증
 *   SMOKE_URL (필수) — 배포된 사이트 URL
 *   EXPECTED_SHA (선택) — 기대 source SHA
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'app.config.json'), 'utf8'));
const appId = config.appId;

const base = process.env.SMOKE_URL;
assert.ok(base, 'SMOKE_URL is required');

async function get(file, { retries = 0 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(new URL(file, base), {
        cache: 'no-store',
        signal: AbortSignal.timeout(20000)
      });
      if (response.status === 200) return response;
    } catch (_) {
      // 네트워크 오류 — 배포 전파 지연 가능
    }
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw new Error(`${file}: HTTP 200 을 받지 못했습니다`);
}

// build-info.json (배포 전파 지연 대비 재시도)
const info = await (await get('build-info.json', { retries: 3 })).json();
if (process.env.EXPECTED_SHA) {
  assert.equal(info.sourceSha, process.env.EXPECTED_SHA, 'source SHA mismatch');
}

// index.html
const html = await (await get('./')).text();
assert.ok(html.includes(appId), 'index.html must contain app id');
assert.ok(!html.includes('{{APP_VERSION}}'), 'index.html must not contain placeholder');

const env = info.environment;
assert.equal(env, process.env.EXPECTED_ENV || env, 'unexpected environment');

// 핵심 자산 (JS/CSS/manifest)
const coreFiles = [
  'app.js',
  'style.css',
  'sw.js',
  'manifest.webmanifest'
];
for (const file of coreFiles) {
  const body = await (await get(file, { retries: 2 })).text();
  assert.ok(body.length > 0, `${file} must not be empty`);
  // manifest 는 JSON 이므로 _build 필드로 검증, 나머지 JS/CSS 는 주입 마커로 검증
  const marker = file === 'manifest.webmanifest'
    ? `"_build": "${info.artifactHash}"`
    : `${appId}-build: ${info.artifactHash}`;
  assert.ok(
    body.includes(marker),
    `${file} must contain build hash ${info.artifactHash}`
  );
}

// 환경별 manifest 검증: 링크된 manifest·이름, installName = shortName (+ 환경 suffix)
const badgeLabel = env === 'preview' ? 'pre' : env === 'development' ? 'dev' : null;
const manifestName =
  env === 'preview' ? 'manifest-pre.webmanifest' :
  env === 'development' ? 'manifest-dev.webmanifest' :
  'manifest.webmanifest';
assert.ok(
  html.includes(`href="./${manifestName}"`),
  `index.html must link the ${env} manifest (${manifestName})`
);
const manifest = await (await get(manifestName)).json();
const installName = badgeLabel ? `${config.shortName} ${badgeLabel}` : config.shortName;
assert.equal(manifest.name, installName, 'manifest.name mismatch');
assert.equal(manifest.short_name, installName, 'manifest.short_name mismatch');

// 환경 배지 (production은 없음)
if (env === 'production') {
  assert.ok(!html.includes('id="app-environment-badge"'), 'production must not have environment badge');
} else {
  const label = badgeLabel;
  assert.ok(html.includes(`>${label}</span>`), `environment badge '${label}' must be present`);
}

console.log(`[smoke] 통과: ${base} · 빌드 ${info.artifactHash} · 환경 ${env} · 버전 ${info.appVersion}`);
