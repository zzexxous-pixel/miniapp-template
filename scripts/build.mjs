/**
 * scripts/build.mjs
 *
 * 환경을 명시적 빌드 입력으로 지정한다.
 *   --env=preview      → 환경 표시 "pre" / 설치 이름 "demo-app pre"
 *   --env=development  → 환경 표시 "dev" / 설치 이름 "demo-app dev"
 *   --env=production   → 환경 표시 없음 / 설치 이름 "demo-app"
 * 또는 환경변수 APP_ENV 로 지정한다.
 *
 * 미지정·잘못된 환경은 조용히 운영으로 처리하지 않고 빌드 오류로 다룬다.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const DIST = path.join(ROOT, parseOut() || 'dist');
const VALID_ENVS = ['preview', 'development', 'production'];

function parseEnvironment() {
  const arg = process.argv.find((a) => a.startsWith('--env='));
  if (arg) return arg.split('=')[1];
  return process.env.APP_ENV || '';
}

function parseOut() {
  const arg = process.argv.find((a) => a.startsWith('--out='));
  if (arg) return arg.split('=').slice(1).join('=');
  return null;
}

function git(...args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  }).trim();
}

function readJSON(relPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), 'utf8'));
}

const config = readJSON('app.config.json');
const pkg = readJSON('package.json');
const appId = config.appId;

const environment = parseEnvironment();
if (!VALID_ENVS.includes(environment)) {
  throw new Error(
    `Invalid or missing environment. Use --env=preview|development|production or APP_ENV. Got: '${environment}'`
  );
}

const badgeLabel = environment === 'preview' ? 'pre' : environment === 'development' ? 'dev' : null;
const installSuffix = badgeLabel ? ` ${badgeLabel}` : '';

// ── 소스 식별 정보 ──────────────────────────────────────────────────────────
let sourceSha = '';
try {
  sourceSha = git('rev-parse', 'HEAD');
} catch {
  // 로컬 테스트에서 git 이력 없을 수 있음 — 빌드 식별은 해시로 보완
}

const buildId = process.env.GITHUB_RUN_ID || crypto.randomBytes(8).toString('hex');
const buildDate = new Date().toISOString();

// ── 빌드 해시 (파일 내용 + 경로 + 빌드 스크립트 자체) ─────────────────────
function computeBuildHash(runtimeFiles) {
  const hash = crypto.createHash('sha256');
  for (const relPath of [...runtimeFiles].sort()) {
    hash.update(relPath);
    const srcPath = path.join(ROOT, relPath === '.nojekyll' ? relPath : path.join('src', relPath));
    hash.update(fs.readFileSync(srcPath));
  }
  hash.update('scripts/build.mjs');
  hash.update(fs.readFileSync(path.join(ROOT, 'scripts/build.mjs'), 'utf8'));
  return hash.digest('hex').slice(0, 8);
}

const buildHash = computeBuildHash(config.build.runtimeFiles);
const envTag = badgeLabel || 'prod';
const cacheName = `${appId}-${envTag}-${buildHash}`;
// 캐시 정리 범위는 "같은 앱·같은 환경"의 이전 빌드로 한정한다.
// 다른 환경(dev/pre/prod)이나 다른 앱의 캐시는 절대 삭제하지 않는다.
const cachePrefix = `${appId}-${envTag}-`;

// ── dist 정리 및 런타임 파일 복사 ──────────────────────────────────────────
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

for (const relPath of config.build.runtimeFiles) {
  // .nojekyll 은 ROOT, 나머지는 src/ 에서 읽는다
  const srcPath = path.join(ROOT, relPath === '.nojekyll' ? relPath : path.join('src', relPath));
  const destPath = path.join(DIST, relPath);
  if (!fs.existsSync(srcPath)) {
    throw new Error(`필수 런타임 파일이 누락되었습니다: ${relPath}`);
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(srcPath, destPath);
}

// ── HTML 치환: 환경 배지 / manifest 링크 / apple 제목 / 버전 / 날짜 ────────
const manifestByEnv = {
  production: 'manifest.webmanifest',
  development: 'manifest-dev.webmanifest',
  preview: 'manifest-pre.webmanifest'
};
const linkedManifest = manifestByEnv[environment];

function stampHtml(html) {
  if (badgeLabel) {
    html = html.replace(
      /<span id="app-environment-badge"[^>]*>[\s\S]*?<\/span>/,
      `<span id="app-environment-badge" class="env-badge env-${badgeLabel}" aria-label="${badgeLabel} 환경">${badgeLabel}</span>`
    );
  } else {
    // production: badge 요소를 완전히 제거
    html = html.replace(
      /<span id="app-environment-badge"[^>]*>[\s\S]*?<\/span>/,
      ''
    );
  }
  // 설치 이름은 연결된 manifest 가 결정하므로 환경별 manifest 를 링크한다.
  html = html.replace(
    /<link\s+rel="manifest"\s+href="\.\/manifest[^"]*">/,
    `<link rel="manifest" href="./${linkedManifest}">`
  );
  html = html.replace(
    /(<meta\s+name="apple-mobile-web-app-title"\s+content=")([^"]*)(")/,
    (_, before, name, after) => `${before}${name}${installSuffix}${after}`
  );
  html = html
    .replaceAll('{{APP_VERSION}}', pkg.version)
    .replaceAll('{{BUILD_DATE}}', buildDate)
    .replaceAll('{{ENV_SUFFIX}}', installSuffix);
  return html;
}

const htmlPath = path.join(DIST, 'index.html');
fs.writeFileSync(htmlPath, stampHtml(fs.readFileSync(htmlPath, 'utf8')), 'utf8');

// ── SW 캐시 이름/접두사 + PRECACHE_ASSETS 치환 (앱 ID + 환경 + 빌드 해시) ──
const swPath = path.join(DIST, 'sw.js');
const sw = fs.readFileSync(swPath, 'utf8');
if (!/const CACHE_NAME = '[^']*';/.test(sw)) {
  throw new Error('sw.js 에서 CACHE_NAME 선언을 찾지 못했습니다.');
}
if (!/const CACHE_PREFIX = '[^']*';/.test(sw)) {
  throw new Error('sw.js 에서 CACHE_PREFIX 선언을 찾지 못했습니다.');
}
// precache 대상: SW 자기 자신과 Pages 전용 파일(.nojekyll)은 제외
const precacheSkip = new Set(['sw.js', '.nojekyll']);
const precacheAssets = config.build.runtimeFiles
  .filter((f) => !precacheSkip.has(f))
  .map((f) => `'./${f}'`)
  .join(',\n  ');
fs.writeFileSync(
  swPath,
  sw
    .replace(/const CACHE_NAME = '[^']*';/, `const CACHE_NAME = '${cacheName}';`)
    .replace(/const CACHE_PREFIX = '[^']*';/, `const CACHE_PREFIX = '${cachePrefix}';`)
    .replace(/const PRECACHE_ASSETS = \[[\s\S]*?\];/, `const PRECACHE_ASSETS = [\n  ${precacheAssets}\n];`),
  'utf8'
);

// ── 빌드 해시 주입 (JS/CSS) → smoke에서 신/구버전 판별 ───────────────────
function injectHashIntoAssets(buildHash) {
  const marker = `${appId}-build: ${buildHash}`;
  const codeAssets = config.build.runtimeFiles.filter(
    (f) => /\.(js|css)$/.test(f)
  );
  for (const relPath of codeAssets) {
    const filePath = path.join(DIST, relPath);
    let content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes(marker)) {
      content = `/* ${marker} */\n` + content;
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }

  // manifest 는 JSON 이므로 _build 필드로 주입
  const manifestFiles = config.build.runtimeFiles.filter((f) => f.endsWith('.webmanifest'));
  for (const relPath of manifestFiles) {
    const manifestPath = path.join(DIST, relPath);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (e) {
      throw new Error(`${relPath} 를 JSON 으로 읽지 못해 빌드 해시를 주입할 수 없습니다: ${e.message}`);
    }
    data._build = buildHash;
    fs.writeFileSync(manifestPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
}

injectHashIntoAssets(buildHash);

// ── build-info.json ───────────────────────────────────────────────────────
fs.writeFileSync(
  path.join(DIST, 'build-info.json'),
  JSON.stringify(
    {
      appVersion: pkg.version,
      environment,
      sourceSha,
      buildId,
      artifactHash: buildHash,
      templateVersion: config.templateVersion,
      buildDate
    },
    null,
    2
  ) + '\n',
  'utf8'
);

// ── 산출물 검증 (절대경로 / 참조 자산 / 미치환 placeholder) ───────────────
function verifyDist() {
  const html = fs.readFileSync(htmlPath, 'utf8');

  // 절대경로 차단 (GitHub Pages 하위 경로 호환)
  const forbiddenPatterns = [
    /href=["']\/(?!\/)/,
    /src=["']\/(?!\/)/,
    /register\(\s*["']\/(?!\/)/
  ];
  for (const regex of forbiddenPatterns) {
    if (regex.test(html)) {
      throw new Error(`절대경로 참조가 검출되었습니다 (${regex}). './' 상대경로를 사용하세요.`);
    }
  }

  // 참조 자산 검사
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

  // 미치환 placeholder 검사
  for (const placeholder of ['{{APP_VERSION}}', '{{BUILD_DATE}}', '{{CACHE_NAME}}', '{{CACHE_PREFIX}}', '{{ENV_SUFFIX}}']) {
    if (html.includes(placeholder)) {
      throw new Error(`미치환 placeholder가 남았습니다: ${placeholder}`);
    }
  }

  // SW 해시 주입 확인
  const swContent = fs.readFileSync(swPath, 'utf8');
  if (!swContent.includes(`${appId}-build: ${buildHash}`)) {
    throw new Error('sw.js 에 빌드 해시가 주입되지 않았습니다.');
  }

  // 환경별 manifest 링크 확인
  if (!fs.readFileSync(htmlPath, 'utf8').includes(`href="./${linkedManifest}"`)) {
    throw new Error(`index.html 의 manifest 링크가 ${environment} 환경용(${linkedManifest})이 아닙니다.`);
  }
}

verifyDist();

console.log(
  `[build] ${environment} 빌드 완료: ${config.build.runtimeFiles.length}개 파일 · ` +
    `빌드 ${buildHash} · 캐시 ${cacheName} · 버전 ${pkg.version}`
);
