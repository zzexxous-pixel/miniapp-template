import { test, expect } from '@playwright/test';

test.describe('체크리스트 기능', () => {
  test('항목을 추가하고 완료 처리할 수 있다', async ({ page }) => {
    await page.goto('/');
    await page.fill('#checklist-input', '테스트 항목');
    await page.click('button[type="submit"]');
    const item = page.locator('.checklist-item', { hasText: '테스트 항목' });
    await expect(item).toBeVisible();
    await item.locator('input[type="checkbox"]').check();
    await expect(item).toHaveClass(/done/);
  });

  test('항목을 삭제할 수 있다', async ({ page }) => {
    await page.goto('/');
    await page.fill('#checklist-input', '삭제할 항목');
    await page.click('button[type="submit"]');
    const item = page.locator('.checklist-item', { hasText: '삭제할 항목' });
    await item.locator('button.delete').click();
    await expect(item).toHaveCount(0);
  });

  test('localStorage에 항목이 저장된다', async ({ page }) => {
    await page.goto('/');
    await page.fill('#checklist-input', '저장 테스트');
    await page.click('button[type="submit"]');
    const stored = await page.evaluate(() => localStorage.getItem('demo-app:checklist'));
    expect(JSON.parse(stored)[0].text).toBe('저장 테스트');
  });
});

test.describe('테마 기능', () => {
  test('테마를 변경할 수 있다', async ({ page }) => {
    await page.goto('/');
    await page.click('button.theme-option[data-theme="dark"]');
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(theme).toBe('dark');
    await page.click('button.theme-option[data-theme="light"]');
    const theme2 = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(theme2).toBe('light');
  });
});

test.describe('앱 정보', () => {
  test('앱 정보 메뉴가 표시된다', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-menu-info');
    const modal = page.locator('#info-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('h3')).toHaveText('앱 정보');
    await page.click('#btn-close-modal');
    await expect(modal).toBeHidden();
  });

  test('푸터에 버전이 표시된다', async ({ page }) => {
    await page.goto('/');
    const footer = await page.textContent('#footer-version');
    expect(footer).toMatch(/demo-app v\d+\.\d+\.\d+/);
  });
});

test.describe('설치 버튼', () => {
  test('설치 버튼이 항상 표시된다', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#btn-install-app')).toBeVisible();
  });
});

test.describe('Service Worker', () => {
  test('SW가 등록된다', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker.ready);
    const registration = await page.evaluate(() => navigator.serviceWorker.getRegistration());
    expect(registration).toBeTruthy();
  });
});
