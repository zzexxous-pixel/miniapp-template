/**
 * scripts/init-project.mjs
 *
 * 템플릿으로 새 프로젝트를 초기화한다.
 *   - app.config.json 을 새 프로젝트 설정으로 생성
 *   - 앱별 변경이 필요한 파일을 안내
 *
 *   실행: npm run init -- --app-id=my-app --short-name="내 앱" --dev-repo=owner/my-app-test --prod-repo=owner/my-app
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);

function getArg(name, fallback = '') {
  const idx = args.findIndex((a) => a.startsWith(`--${name}=`));
  return idx !== -1 ? args[idx].split('=').slice(1).join('=') : fallback;
}

const appId = getArg('app-id', 'my-app');
const shortName = getArg('short-name', appId);
const title = getArg('title', shortName);
const description = getArg('description', `${shortName} — 미니 앱`);
const devRepo = getArg('dev-repo', 'owner/my-app-test');
const prodRepo = getArg('prod-repo', 'owner/my-app');
const devUrl = getArg('dev-url', `https://${devRepo.split('/')[0]}.github.io/${devRepo.split('/')[1]}/`);
const prodUrl = getArg('prod-url', `https://${prodRepo.split('/')[0]}.github.io/${prodRepo.split('/')[1]}/`);
const templateVersion = getArg('template-version', '1.0.0');

const config = {
  appId,
  shortName,
  title,
  description,
  devRepo,
  prodRepo,
  devUrl,
  prodUrl,
  preview: {
    path: 'preview',
    environment: 'pre',
    refVariable: 'PREVIEW_REF',
    defaultRef: ''
  },
  pwa: {
    enabled: true,
    offline: 'partial'
  },
  build: {
    runtimeFiles: [
      '.nojekyll',
      'index.html',
      'style.css',
      'app.js',
      'sw.js',
      'manifest.webmanifest',
      'manifest-dev.webmanifest',
      'manifest-pre.webmanifest',
      'assets/icon-192.png',
      'assets/icon-512.png',
      'assets/apple-touch-icon.png'
    ],
    command: 'node scripts/build.mjs'
  },
  checks: {
    extra: []
  },
  templateVersion
};

fs.writeFileSync(
  path.join(process.cwd(), 'app.config.json'),
  JSON.stringify(config, null, 2) + '\n',
  'utf8'
);

console.log('[init] 프로젝트 초기화 완료');
console.log('');
console.log('  app.config.json 생성:');
console.log(`    appId:      ${appId}`);
console.log(`    shortName:  ${shortName}`);
console.log(`    devRepo:    ${devRepo}`);
console.log(`    prodRepo:   ${prodRepo}`);
console.log('');
console.log('다음 작업:');
console.log('  1. package.json 의 name/version을 확인합니다.');
console.log('  2. src/ 의 index.html, style.css, app.js 를 앱에 맞게 수정합니다.');
console.log('  3. assets/ 에 아이콘을 추가합니다.');
console.log('  4. npm run build -- --env=production 로 빌드를 검증합니다.');
console.log('  5. GitHub Pages 설정을 확인합니다 (Source = GitHub Actions).');
