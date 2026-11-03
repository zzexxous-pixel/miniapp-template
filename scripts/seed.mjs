/**
 * scripts/seed.mjs
 *
 * 현재 저장소의 **커밋된 상태**를 개발 저장소(비어 있는 저장소)의 main 으로 시드한다.
 *   - 작업 트리가 깨끗해야 한다 (미커밋 변경이 있으면 중단)
 *   - app.config.json 의 devRepo 와 대상 저장소가 일치해야 한다
 *   - 대상 저장소에 이미 main 이 있으면 거부한다 (--replace 로만 허용)
 *   - 푸시 전에 --dry-run 푸시로 쓰기 권한을 먼저 확인한다 (403 이면 즉시 중단)
 *
 *   실행:
 *     node scripts/seed.mjs --dry-run          # 검사만 (원격 쓰기 없음)
 *     node scripts/seed.mjs                    # app.config.json devRepo 로 시드
 *     node scripts/seed.mjs --target=owner/repo
 *
 *   시드는 "새 저장소에 최초 1회" 용도다. 이후 변경은 일반 main push/PR 로 반영한다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const args = process.argv.slice(2);

function getArg(name, fallback = '') {
  const idx = args.findIndex((a) => a.startsWith(`--${name}=`));
  return idx !== -1 ? args[idx].split('=').slice(1).join('=') : fallback;
}
function hasFlag(name) {
  return args.includes(`--${name}`);
}

function fail(message) {
  console.error(`[seed] 실패: ${message}`);
  process.exit(1);
}
function info(message) {
  console.log(`[seed] ${message}`);
}
function git(gitArgs, options = {}) {
  return execFileSync('git', gitArgs, { cwd: ROOT, encoding: 'utf8', ...options }).trim();
}

if (hasFlag('help')) {
  info('사용법: node scripts/seed.mjs [--dry-run] [--replace] [--target=owner/repo]');
  process.exit(0);
}

// ── 설정 로드 ────────────────────────────────────────────────
const configPath = path.join(ROOT, 'app.config.json');
if (!fs.existsSync(configPath)) fail('app.config.json 이 없습니다. npm run init 을 실행하세요.');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const target = getArg('target', config.devRepo);
if (!/^[^/]+\/[^/]+$/.test(target)) fail(`대상 저장소는 owner/repo 형식이어야 합니다: ${target}`);

// 대상은 devRepo(개발 저장소)여야 한다. 운영 저장소·템플릿에 시드하는 사고를 막는다.
if (target !== config.devRepo) {
  fail(
    `대상(${target})이 app.config.json devRepo(${config.devRepo}) 와 다릅니다. ` +
      `시드는 개발 저장소에만 수행합니다. (설정이 맞다면 app.config.json 의 devRepo 를 먼저 갱신하세요)`
  );
}

const dryRun = hasFlag('dry-run');
const replace = hasFlag('replace');

// ── 로컬 상태 검사 ──────────────────────────────────────────
const dirty = git(['status', '--porcelain']);
if (dirty) fail(`작업 트리에 미커밋 변경이 있습니다. 시드는 커밋된 상태만 옮깁니다.\n${dirty}`);

let sourceSha;
try {
  sourceSha = git(['rev-parse', 'HEAD']);
} catch {
  fail('커밋이 없습니다. 먼저 시드할 내용을 커밋하세요.');
}
const treeSha = git(['rev-parse', 'HEAD^{tree}']);
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
const fileCount = Number(git(['ls-tree', '-r', '--name-only', 'HEAD']).split('\n').filter(Boolean).length);

// --remote 로 전송 URL 을 바꿀 수 있다 (로컬 검증·SSH 사용 시). 기본은 https.
const remoteUrl = getArg('remote', `https://github.com/${target}.git`);
const commitMessage = [
  `chore: seed ${config.appId} from miniapp-template v${config.templateVersion}`,
  '',
  `source-repo: ${git(['remote', 'get-url', 'origin'])}`,
  `source-sha: ${sourceSha}`,
  `source-branch: ${branch}`,
  `template-version: ${config.templateVersion}`,
  `app-version: ${pkg.version}`,
  ''
].join('\n');

// ── 시드 커밋 생성 (작업 트리·index 를 건드리지 않음) ─────────
const authorName = getArg('author-name', safeGitConfig('user.name', 'miniapp-template'));
const authorEmail = getArg('author-email', safeGitConfig('user.email', 'miniapp-template@users.noreply.github.com'));

function safeGitConfig(key, fallback) {
  try {
    const value = git(['config', '--get', key]);
    return value || fallback;
  } catch {
    return fallback;
  }
}

const seedCommit = git(['commit-tree', treeSha, '-m', commitMessage], {
  env: {
    ...process.env,
    GIT_AUTHOR_NAME: authorName,
    GIT_AUTHOR_EMAIL: authorEmail,
    GIT_COMMITTER_NAME: authorName,
    GIT_COMMITTER_EMAIL: authorEmail
  }
});

info(`대상: ${target} (${remoteUrl})`);
info(`소스: ${branch}@${sourceSha.slice(0, 7)} · 파일 ${fileCount}개 · ${config.appId} v${pkg.version} · 템플릿 v${config.templateVersion}`);
info(`시드 커밋: ${seedCommit.slice(0, 7)} → refs/heads/main`);

// ── 원격 상태 검사 ──────────────────────────────────────────
let remoteMain = '';
try {
  remoteMain = git(['ls-remote', '--heads', remoteUrl, 'refs/heads/main']).split('\t')[0] || '';
} catch (error) {
  fail(`대상 저장소에 접근할 수 없습니다: ${target}\n${(error.stderr || error.message).toString().trim()}`);
}

if (remoteMain && !replace) {
  fail(
    `대상 저장소에 이미 main 이 있습니다 (${remoteMain.slice(0, 7)}). ` +
      `시드는 빈 저장소 전용입니다. 갱신은 main push/PR 로 하세요. (덮어쓰려면 --replace)`
  );
}
info(remoteMain ? `원격 main 존재 — --replace 로 덮어쓴다 (${remoteMain.slice(0, 7)})` : '원격 main 없음 — 최초 시드');

// ── 쓰기 권한 프로브 (실제 푸시와 동일한 인증 경로) ───────────
const pushArgs = ['push', '--dry-run', remoteUrl, `${seedCommit}:refs/heads/main`];
if (replace) pushArgs.splice(2, 0, '--force');
try {
  git(pushArgs, { stdio: 'pipe' });
  info('쓰기 권한 확인: 원격 푸시 가능 (dry-run 통과)');
} catch (error) {
  const output = `${error.stdout || ''}${error.stderr || ''}`.toString().trim();
  fail(
    `원격 쓰기 권한이 없습니다 (쓰기 프로브 실패).\n` +
      `  대상: ${target}\n` +
      `  원인: ${output.split('\n').filter(Boolean).slice(-2).join(' / ')}\n` +
      `  조치: Arena 의 GitHub 연결에 ${target} 저장소 쓰기 권한을 추가한 뒤 다시 실행하세요.`
  );
}

if (dryRun) {
  info('--dry-run: 푸시하지 않고 종료합니다.');
  process.exit(0);
}

// ── 실제 푸시 ───────────────────────────────────────────────
try {
  const finalArgs = ['push', remoteUrl, `${seedCommit}:refs/heads/main`];
  if (replace) finalArgs.splice(1, 0, '--force');
  git(finalArgs, { stdio: 'pipe' });
} catch (error) {
  const output = `${error.stdout || ''}${error.stderr || ''}`.toString().trim();
  fail(`푸시에 실패했습니다.\n${output}`);
}

const githubUrl = remoteUrl === `https://github.com/${target}.git`;
if (githubUrl) {
  info(`시드 완료: https://github.com/${target}/commit/${seedCommit}`);
} else {
  info(`시드 완료: ${remoteUrl} → refs/heads/main (${seedCommit.slice(0, 7)}) — GitHub 대상이 아니므로 저장소 설정 안내는 생략`);
  process.exit(0);
}
info('다음 단계:');
console.log(`
  1. deploy-dev 워크플로가 main push 로 자동 실행되는지 확인
       gh run list -R ${target} -L 5
  2. 저장소 설정 확인 (agent 토큰 권한이 없으면 사용자가 직접)
       - Pages Source = GitHub Actions
       - repository variable PREVIEW_REF (preview 대상, 없으면 dev 만 배포)
       - environment production + required reviewers
       - secret DEPLOY_TOKEN (운영 저장소 Contents RW)
  3. 배포 후 smoke 통과 확인 → dev URL: ${config.devUrl}
`);
