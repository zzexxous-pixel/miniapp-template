/**
 * app.js
 * demo-app — 예제 앱 (체크리스트 / 테마 / 앱 정보 / 설치 버튼)
 */

// ── localStorage (앱별 키 prefix) ──────────────────────────────────────────
const STORAGE_PREFIX = 'demo-app:';
const STORAGE_KEY_CHECKLIST = `${STORAGE_PREFIX}checklist`;
const STORAGE_KEY_THEME = `${STORAGE_PREFIX}theme`;

function loadJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ── 체크리스트 ─────────────────────────────────────────────────────────────
const checklistForm = document.getElementById('checklist-form');
const checklistInput = document.getElementById('checklist-input');
const checklistItems = document.getElementById('checklist-items');
const checklistEmpty = document.getElementById('checklist-empty');

let checklist = loadJSON(STORAGE_KEY_CHECKLIST, []);

function renderChecklist() {
  checklistItems.innerHTML = '';
  if (checklist.length === 0) {
    checklistEmpty.hidden = false;
  } else {
    checklistEmpty.hidden = true;
  }
  for (const [index, item] of checklist.entries()) {
    const li = document.createElement('li');
    li.className = `checklist-item ${item.done ? 'done' : ''}`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = item.done;
    checkbox.addEventListener('change', () => {
      checklist[index].done = checkbox.checked;
      li.classList.toggle('done', checkbox.checked);
      saveJSON(STORAGE_KEY_CHECKLIST, checklist);
    });

    const label = document.createElement('span');
    label.textContent = item.text;

    const del = document.createElement('button');
    del.className = 'delete';
    del.textContent = '×';
    del.setAttribute('aria-label', '삭제');
    del.addEventListener('click', () => {
      checklist.splice(index, 1);
      saveJSON(STORAGE_KEY_CHECKLIST, checklist);
      renderChecklist();
    });

    li.append(checkbox, label, del);
    checklistItems.appendChild(li);
  }
}

checklistForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = checklistInput.value.trim();
  if (!text) return;
  checklist.push({ text, done: false });
  saveJSON(STORAGE_KEY_CHECKLIST, checklist);
  checklistInput.value = '';
  renderChecklist();
});

renderChecklist();

// ── 테마 ───────────────────────────────────────────────────────────────────
const themeButtons = document.querySelectorAll('.theme-option');

function applyTheme(theme) {
  const effective = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;
  document.documentElement.dataset.theme = effective;
  themeButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

const savedTheme = loadJSON(STORAGE_KEY_THEME, 'system');
applyTheme(savedTheme);

themeButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const theme = btn.dataset.theme;
    saveJSON(STORAGE_KEY_THEME, theme);
    applyTheme(theme);
  });
});

// ── 앱 정보 ────────────────────────────────────────────────────────────────
async function loadBuildInfo() {
  try {
    const response = await fetch('./build-info.json');
    return await response.json();
  } catch {
    return null;
  }
}

async function renderAppInfo() {
  const info = await loadBuildInfo();
  const container = document.getElementById('app-info-content');
  container.innerHTML = '';

  const rows = [
    ['앱 이름', 'demo-app'],
    ['앱 버전', info ? info.appVersion : '—'],
    ['환경', info ? info.environment : '—'],
    ['배포일', info ? info.buildDate : '—'],
    ['짧은 빌드 ID', info ? info.artifactHash : '—'],
    ['템플릿 버전', info ? info.templateVersion : '—']
  ];

  for (const [label, value] of rows) {
    const row = document.createElement('div');
    row.className = 'info-row';
    const labelEl = document.createElement('span');
    labelEl.className = 'info-label';
    labelEl.textContent = label;
    const valueEl = document.createElement('span');
    valueEl.className = 'info-value';
    valueEl.textContent = value;
    row.append(labelEl, valueEl);
    container.appendChild(row);
  }
}

renderAppInfo();

// 앱 정보 모달
const infoModal = document.getElementById('info-modal');
const btnMenuInfo = document.getElementById('btn-menu-info');
const btnCloseModal = document.getElementById('btn-close-modal');
const modalContent = document.getElementById('app-info-modal-content');
const btnCopyDiagnostics = document.getElementById('btn-copy-diagnostics');

btnMenuInfo.addEventListener('click', async () => {
  const info = await loadBuildInfo();
  const lines = [
    `앱: demo-app`,
    `버전: ${info?.appVersion || '—'}`,
    `환경: ${info?.environment || '—'}`,
    `배포일: ${info?.buildDate || '—'}`,
    `빌드 ID: ${info?.artifactHash || '—'}`,
    `템플릿: ${info?.templateVersion || '—'}`,
    `UA: ${navigator.userAgent}`,
    `언어: ${navigator.language}`,
    `주소: ${location.href}`
  ];
  modalContent.innerHTML = `<pre>${lines.map((l) => `  ${l}`).join('\n')}</pre>`;
  infoModal.classList.remove('hidden');
});

btnCloseModal.addEventListener('click', () => {
  infoModal.classList.add('hidden');
});

infoModal.addEventListener('click', (e) => {
  if (e.target === infoModal) infoModal.classList.add('hidden');
});

btnCopyDiagnostics.addEventListener('click', async () => {
  const text = modalContent.querySelector('pre')?.textContent || '';
  try {
    await navigator.clipboard.writeText(text);
    btnCopyDiagnostics.textContent = '복사 완료';
    setTimeout(() => { btnCopyDiagnostics.textContent = '진단 정보 복사'; }, 2000);
  } catch {
    btnCopyDiagnostics.textContent = '복사 실패';
    setTimeout(() => { btnCopyDiagnostics.textContent = '진단 정보 복사'; }, 2000);
  }
});

// ── 설치 버튼 ──────────────────────────────────────────────────────────────
const installButton = document.getElementById('btn-install-app');
const installStatus = document.getElementById('app-install-status');

let installPromptEvent = null;
let installed = false;
let busy = false;

const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
  (navigator.standalone === true);
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function renderInstallButton() {
  const isInstalled = installed || isStandalone;
  installButton.hidden = false;
  installButton.disabled = busy || isInstalled || !installPromptEvent;

  if (busy) {
    installButton.textContent = '설치 확인 중…';
  } else if (isInstalled) {
    installButton.textContent = '앱 설치';
  } else {
    installButton.textContent = '앱 설치';
  }

  if (isInstalled) {
    installStatus.textContent = isStandalone
      ? '이미 앱으로 실행 중입니다.'
      : '앱 설치가 완료되었습니다. 홈 화면에서 실행해 주세요.';
  } else if (installPromptEvent) {
    installStatus.textContent = '앱 설치 버튼을 누르면 브라우저의 설치 창이 열립니다.';
  } else {
    installStatus.textContent = '이미 설치했거나 이 브라우저에서 설치 창을 지원하지 않습니다. ' +
      (isIOS ? 'Safari에서 공유 버튼 → "홈 화면에 추가"로 설치해 주세요.'
             : '설치한 앱을 실행하거나 브라우저 메뉴의 "앱 설치" 또는 "홈 화면에 추가"를 확인해 주세요.');
  }
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPromptEvent = event;
  renderInstallButton();
});

window.addEventListener('appinstalled', () => {
  installed = true;
  installPromptEvent = null;
  renderInstallButton();
});

window.matchMedia('(display-mode: standalone)').addEventListener?.('change', renderInstallButton);

installButton.addEventListener('click', async () => {
  if (busy) return;
  if (installed || isStandalone) {
    renderInstallButton();
    return;
  }
  if (!installPromptEvent) {
    renderInstallButton();
    return;
  }
  const prompt = installPromptEvent;
  installPromptEvent = null; // 각 설치 이벤트는 한 번만 소비
  busy = true;
  renderInstallButton();
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    installStatus.textContent =
      choice.outcome === 'accepted'
        ? '설치를 요청했습니다. 브라우저 안내를 완료해 주세요.'
        : '설치를 취소했습니다. 나중에 브라우저 메뉴에서 다시 설치할 수 있습니다.';
  } catch {
    installStatus.textContent =
      '설치 창을 열지 못했습니다. 브라우저 메뉴의 "앱 설치" 또는 "홈 화면에 추가"를 이용해 주세요.';
  } finally {
    busy = false;
    installButton.textContent = '앱 설치';
    installButton.disabled = installed || isStandalone;
  }
});

renderInstallButton();

// ── Service Worker 등록 ────────────────────────────────────────────────────
// 상대 URL로 등록해 Pages 하위 경로(/repo/), preview(/repo/preview/) 모두에서
// 자기 디렉터리를 scope로 사용한다. updateViaCache:'none' — SW 스크립트 자체
// 캐시를 우회해 브라우저가 매번 업데이트를 확인할 수 있게 한다.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        new URL('./sw.js', location.href).href,
        { scope: new URL('./', location.href).pathname, updateViaCache: 'none' }
      );
      // 탭 복귀 시 업데이트 검사 (모바일에서 재진입 없이도 새 버전 확인)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch(() => {});
        }
      });
    } catch (err) {
      console.warn('[sw] 등록 실패:', err);
    }
  });
}
