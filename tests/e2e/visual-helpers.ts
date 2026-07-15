import { expect, type Page } from '@playwright/test';

export async function openSeededHome(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('/');
  await expect(page.getByRole('region', { name: '首页工作台' })).toBeVisible();
  await expect(page.locator('main[data-app-ready="true"]')).toBeVisible({ timeout: 30_000 });
  await page.addStyleTag({
    content: '.home-recent-copy > span > small { visibility: hidden !important; }'
  });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

export async function expectNoHorizontalPageOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
}

export function primaryNavigation(page: Page) {
  return page.getByRole('complementary', { name: '导航' });
}
