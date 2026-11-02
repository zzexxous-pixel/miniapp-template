import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');

function runBuild(args) {
  try {
    execFileSync(process.execPath, ['scripts/build.mjs', ...args], {
      cwd: ROOT,
      encoding: 'utf8'
    });
    return { ok: true, output: '' };
  } catch (err) {
    return { ok: false, output: err.stdout || err.stderr || String(err.message) };
  }
}

test('빌드: production 환경 빌드 성공', () => {
  const result = runBuild(['--env=production']);
  assert.equal(result.ok, true);
  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  assert.ok(html.includes('demo-app'));
  assert.ok(!html.includes('{{APP_VERSION}}'));
  assert.ok(!html.includes('>dev</span>'));
  assert.ok(!html.includes('>pre</span>'));
  assert.ok(html.includes('name="apple-mobile-web-app-title" content="demo-app"'));
  // 운영 환경은 기본 manifest 링크 유지, 환경 배지 요소 자체가 없음
  assert.ok(html.includes('href="./manifest.webmanifest"'));
  assert.ok(!html.includes('id="app-environment-badge"'));
  // 푸터: 앱이름 vX.Y.Z (운영은 환경 suffix 없음)
  assert.ok(html.includes('id="footer-version">demo-app v2.0.0</span>'));
});

test('빌드: development 환경 배지가 dev', () => {
  const result = runBuild(['--env=development']);
  assert.equal(result.ok, true);
  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  assert.ok(html.includes('>dev</span>'));
  assert.ok(html.includes('content="demo-app dev"'));
  // 설치 이름은 연결된 manifest 가 결정 → dev manifest 링크
  assert.ok(html.includes('href="./manifest-dev.webmanifest"'));
  assert.ok(html.includes('id="footer-version">demo-app v2.0.0 dev</span>'));
  const sw = fs.readFileSync(path.join(DIST, 'sw.js'), 'utf8');
  assert.match(sw, /const CACHE_PREFIX = 'demo-app-dev-';/);
});

test('빌드: preview 환경 배지가 pre', () => {
  const result = runBuild(['--env=preview']);
  assert.equal(result.ok, true);
  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  assert.ok(html.includes('>pre</span>'));
  assert.ok(html.includes('content="demo-app pre"'));
  assert.ok(html.includes('href="./manifest-pre.webmanifest"'));
  assert.ok(html.includes('id="footer-version">demo-app v2.0.0 pre</span>'));
  const sw = fs.readFileSync(path.join(DIST, 'sw.js'), 'utf8');
  assert.match(sw, /const CACHE_PREFIX = 'demo-app-pre-';/);
});

test('빌드: 잘못된 환경은 빌드 실패', () => {
  const result = runBuild(['--env=invalid']);
  assert.equal(result.ok, false);
  assert.match(result.output, /Invalid or missing environment/);
});

test('build-info.json 생성 및 환경별 값', () => {
  runBuild(['--env=production']);
  const info = JSON.parse(fs.readFileSync(path.join(DIST, 'build-info.json'), 'utf8'));
  assert.equal(info.environment, 'production');
  assert.equal(info.appVersion, '2.0.0');
  assert.ok(info.artifactHash);
  assert.ok(info.templateVersion);
  assert.ok(info.buildDate);
});

test('빌드 해시가 JS/CSS/sw.js에 주입됨', () => {
  runBuild(['--env=production']);
  const info = JSON.parse(fs.readFileSync(path.join(DIST, 'build-info.json'), 'utf8'));
  for (const file of ['app.js', 'style.css', 'sw.js']) {
    const content = fs.readFileSync(path.join(DIST, file), 'utf8');
    assert.ok(
      content.includes(`demo-app-build: ${info.artifactHash}`),
      `${file} 에 빌드 해시가 있어야 합니다`
    );
  }
});

test('sw.js CACHE_NAME 치환', () => {
  runBuild(['--env=production']);
  const sw = fs.readFileSync(path.join(DIST, 'sw.js'), 'utf8');
  assert.match(sw, /const CACHE_NAME = 'demo-app-prod-[a-f0-9]{8}';/);
});
