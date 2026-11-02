import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.join(process.cwd());

test('app.config.json 구조 검증', () => {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.config.json'), 'utf8'));
  for (const field of ['appId', 'shortName', 'title', 'description', 'devRepo', 'prodRepo', 'devUrl', 'prodUrl']) {
    assert.ok(config[field], `${field} 이 있어야 합니다`);
  }
  assert.equal(config.appId, 'demo-app');
  assert.ok(config.build.runtimeFiles.length > 0);
  assert.ok(config.templateVersion);
});

test('package.json 버전 형식 (SemVer)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  assert.equal(pkg.private, true);
});

test('manifest 파일들이 runtimeFiles에 포함됨', () => {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.config.json'), 'utf8'));
  for (const manifest of ['manifest.webmanifest', 'manifest-dev.webmanifest', 'manifest-pre.webmanifest']) {
    assert.ok(config.build.runtimeFiles.includes(manifest), `${manifest} 가 runtimeFiles에 포함되어야 합니다`);
  }
});

test('manifest-dev 와 manifest-pre 의 이름이 환경별 suffix 를 포함', () => {
  const dev = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest-dev.webmanifest'), 'utf8'));
  const pre = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/manifest-pre.webmanifest'), 'utf8'));
  assert.equal(dev.name, 'demo-app dev');
  assert.equal(dev.short_name, 'demo-app dev');
  assert.equal(pre.name, 'demo-app pre');
  assert.equal(pre.short_name, 'demo-app pre');
});

test('index.html 에 환경 배지 슬롯과 placeholder가 있음', () => {
  const html = fs.readFileSync(path.join(ROOT, 'src/index.html'), 'utf8');
  assert.ok(html.includes('id="app-environment-badge"'));
  assert.ok(html.includes('{{APP_VERSION}}'));
  assert.ok(html.includes('{{BUILD_DATE}}'));
  assert.ok(html.includes('{{ENV_SUFFIX}}'));
});

test('sw.js 에 CACHE_NAME/CACHE_PREFIX placeholder가 있음', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'src/sw.js'), 'utf8');
  assert.ok(sw.includes("const CACHE_NAME = '{{CACHE_NAME}}';"));
  assert.ok(sw.includes("const CACHE_PREFIX = '{{CACHE_PREFIX}}';"));
  // 앱별 고정 캐시 접두사를 소스 SW에 남기지 않는다 (빌드 시 config에서 주입)
  assert.ok(!/const CACHE_PREFIX = '(?!{{)[^']*';/.test(sw));
});
