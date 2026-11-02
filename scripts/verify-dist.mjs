/**
 * scripts/verify-dist.mjs
 *
 * dist/ 산출물을 독립적으로 검사한다.
 *   - 런타임 allowlist (dist 외 파일이 없는지)
 *   - 참조 자산 누락
 *   - 절대경로 차단
 *   - 미치환 placeholder
 *   - 빌드 해시 주입 확인
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.config.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

if (!fs.existsSync(DIST)) {
  throw new Error('dist/ 가 없습니다. 먼저 빌드하세요.');
}

// dist 에 allowlist 외 파일이 있는지 검사
function walk(dir, base = '') {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      found.push(...walk(path.join(dir, entry.name), relPath));
    } else {
      found.push(relPath);
    }
  }
  return found;
}

const distFiles = walk(DIST);
const runtimeSet = new Set(config.build.runtimeFiles);
// build-info.json 은 빌드 생성물로 allowlist에 포함하지 않는다
const allowedExtra = new Set(['build-info.json']);
const extra = distFiles.filter((f) => !runtimeSet.has(f) && !allowedExtra.has(f));
if (extra.length > 0) {
  throw new Error(`dist/ 에 allowlist 외 파일이 있습니다: ${extra.join(', ')}`);
}

// build-info.json 검증
const info = JSON.parse(fs.readFileSync(path.join(DIST, 'build-info.json'), 'utf8'));
if (info.appVersion !== pkg.version) {
  throw new Error(`build-info.json 버전(${info.appVersion})가 package.json(${pkg.version})와 다릅니다.`);
}
if (!['preview', 'development', 'production'].includes(info.environment)) {
  throw new Error(`build-info.json 환경(${info.environment})가 유효하지 않습니다.`);
}

// HTML 검증
const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const forbiddenPatterns = [
  /href=["']\/(?!\/)/,
  /src=["']\/(?!\/)/,
  /register\(\s*["']\/(?!\/)/
];
for (const regex of forbiddenPatterns) {
  if (regex.test(html)) {
    throw new Error(`절대경로 참조가 검출되었습니다 (${regex}).`);
  }
}

const refs = new Set();
const attrPattern = /(?:href|src)="(\.\/[^"'?#]+)["']/g;
let match;
while ((match = attrPattern.exec(html)) !== null) {
  refs.add(match[1].replace(/^\.\//, ''));
}
for (const relPath of refs) {
  if (relPath.startsWith('data:')) continue;
  if (!fs.existsSync(path.join(DIST, relPath))) {
    throw new Error(`index.html 이 참조하지만 dist 에 없는 파일: ${relPath}`);
  }
}

for (const placeholder of ['{{APP_VERSION}}', '{{BUILD_DATE}}', '{{CACHE_NAME}}', '{{CACHE_PREFIX}}', '{{ENV_SUFFIX}}']) {
  if (html.includes(placeholder)) {
    throw new Error(`미치환 placeholder가 남았습니다: ${placeholder}`);
  }
}

// 필수 런타임 파일 누락 검사
for (const relPath of config.build.runtimeFiles) {
  if (!fs.existsSync(path.join(DIST, relPath))) {
    throw new Error(`필수 런타임 파일이 dist 에 없습니다: ${relPath}`);
  }
}

// 환경별 manifest 링크 검사 (설치 이름은 연결된 manifest 가 결정)
const manifestByEnv = {
  production: 'manifest.webmanifest',
  development: 'manifest-dev.webmanifest',
  preview: 'manifest-pre.webmanifest'
};
const expectedManifest = manifestByEnv[info.environment];
if (!html.includes(`href="./${expectedManifest}"`)) {
  throw new Error(`index.html 의 manifest 링크가 ${info.environment} 환경용(${expectedManifest})이 아닙니다.`);
}

// 빌드 해시 주입 확인
const buildMarker = `${config.appId}-build: ${info.artifactHash}`;
const swContent = fs.readFileSync(path.join(DIST, 'sw.js'), 'utf8');
if (!swContent.includes(buildMarker)) {
  throw new Error('sw.js 에 빌드 해시가 주입되지 않았습니다.');
}
// 캐시 격리: 정리 접두사는 "앱 ID + 환경"까지 포함해야 한다 (다른 환경/앱 캐시 삭제 방지)
const envTag = info.environment === 'production' ? 'prod' : info.environment === 'development' ? 'dev' : 'pre';
if (!swContent.includes(`const CACHE_PREFIX = '${config.appId}-${envTag}-';`)) {
  throw new Error(`sw.js 의 CACHE_PREFIX가 앱·환경 격리 접두사(${config.appId}-${envTag}-)가 아닙니다.`);
}

for (const relPath of config.build.runtimeFiles) {
  if (/\.(js|css)$/.test(relPath)) {
    const content = fs.readFileSync(path.join(DIST, relPath), 'utf8');
    if (!content.includes(buildMarker)) {
      throw new Error(`${relPath} 에 빌드 해시가 주입되지 않았습니다.`);
    }
  }
  if (relPath.endsWith('.webmanifest')) {
    const manifest = JSON.parse(fs.readFileSync(path.join(DIST, relPath), 'utf8'));
    if (manifest._build !== info.artifactHash) {
      throw new Error(`${relPath} 의 _build 필드가 빌드 해시와 일치하지 않습니다.`);
    }
  }
}

console.log(`[verify-dist] 산출물 검사 통과: ${distFiles.length}개 파일 · 빌드 ${info.artifactHash} · 환경 ${info.environment}`);
