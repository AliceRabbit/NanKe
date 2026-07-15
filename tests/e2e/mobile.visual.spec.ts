import { test, expect } from './fixtures';
import { expectNoHorizontalPageOverflow, openSeededHome, primaryNavigation } from './visual-helpers';

test('mobile navigation visual baseline and more-menu interaction', async ({ page, seededApp }) => {
  expect(seededApp.conversationId).toBeTruthy();
  await openSeededHome(page);
  const navigation = primaryNavigation(page);

  await expect(navigation.getByRole('button', { name: '首页', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(navigation.getByRole('button', { name: '聊天', exact: true })).toBeVisible();
  await expect(navigation.getByRole('button', { name: '聊天记录', exact: true })).toBeVisible();
  await expect(navigation.getByRole('button', { name: '角色', exact: true })).toBeVisible();

  await navigation.getByRole('button', { name: '更多', exact: true }).click();
  const moreMenu = page.getByRole('navigation', { name: '更多' });
  await expect(moreMenu).toBeVisible();
  await expect(moreMenu.getByRole('button', { name: '用户设定', exact: true })).toBeVisible();
  await expect(moreMenu.getByRole('button', { name: '预设', exact: true })).toBeVisible();
  await page.mouse.move(320, 100);
  await expectNoHorizontalPageOverflow(page);
  await expect(page).toHaveScreenshot('mobile-navigation.png');

  await moreMenu.getByRole('button', { name: '预设', exact: true }).click();
  await expect(moreMenu).toBeHidden();
  await expect(page.getByRole('dialog', { name: '预设', exact: true })).toBeVisible();
});
