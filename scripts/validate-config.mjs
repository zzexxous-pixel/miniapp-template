/**
 * scripts/validate-config.mjs
 * app.config.json 의 구조와 유효성을 검사한다.
 *   - 필수 항목 존재
 *   - 버전 형식 (SemVer)
 *   - URL 형식
 *   - runtimeFiles 중복 없음
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const configPath = path.join(ROOT, 'app.config.json');
const pkgPath = path.join(ROOT, 'package.json');

if (!fs.existsSync(configPath)) {
  throw new Error('app.config.json 이 없습니다. npm run init 을 실행하세요.');
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const requiredFields = ['appId', 'shortName', 'title', 'description', 'devRepo', 'prodRepo', 'devUrl', 'prodUrl'];
for (const field of requiredFields) {
  if (!config[field]) {
    throw new Error(`app.config.json 에 필수 항목이 없습니다: ${field}`);
  }
}

// SemVer 형식 검증 (MAJOR.MINOR.PATCH)
if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) {
  throw new Error(`package.json version(${pkg.version})는 MAJOR.MINOR.PATCH 형식이어야 합니다.`);
}

// URL 형식 검증
for (const [field, url] of Object.entries({ devUrl: config.devUrl, prodUrl: config.prodUrl })) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      throw new Error('https only');
    }
  } catch {
    throw new Error(`${field}(${url})는 유효한 https URL이어야 합니다.`);
  }
}

// repo 형식 검증
for (const [field, repo] of Object.entries({ devRepo: config.devRepo, prodRepo: config.prodRepo })) {
  if (!/^[^/]+\/[^/]+$/.test(repo)) {
    throw new Error(`${field}(${repo})는 owner/repo 형식이어야 합니다.`);
  }
}

// runtimeFiles 중복 및 형식
const runtimeFiles = config.build?.runtimeFiles || [];
if (runtimeFiles.length === 0) {
  throw new Error('build.runtimeFiles가 비어 있습니다.');
}
if (new Set(runtimeFiles).size !== runtimeFiles.length) {
  throw new Error('build.runtimeFiles에 중복 항목이 있습니다.');
}
for (const file of runtimeFiles) {
  if (file.startsWith('/') || file.includes('..')) {
    throw new Error(`runtimeFiles에 부적합한 경로가 있습니다: ${file}`);
  }
}

// manifest 파일이 runtimeFiles에 포함되어 있는지
for (const manifest of ['manifest.webmanifest', 'manifest-dev.webmanifest', 'manifest-pre.webmanifest']) {
  if (!runtimeFiles.includes(manifest)) {
    console.warn(`[validate-config] 경고: ${manifest}가 runtimeFiles에 포함되지 않았습니다.`);
  }
}

// templateVersion 형식
if (!/^\d+\.\d+\.\d+$/.test(config.templateVersion)) {
  throw new Error(`templateVersion(${config.templateVersion})는 MAJOR.MINOR.PATCH 형식이어야 합니다.`);
}

console.log(`[validate-config] 설정 검사 통과: ${config.appId} · 템플릿 ${config.templateVersion} · 앱 버전 ${pkg.version}`);
