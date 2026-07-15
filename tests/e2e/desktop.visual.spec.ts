import { test, expect } from './fixtures';
import { expectNoHorizontalPageOverflow, openSeededHome, primaryNavigation } from './visual-helpers';

test('homepage visual baseline', async ({ page, seededApp }) => {
  expect(seededApp.conversationId).toBeTruthy();
  await openSeededHome(page);

  await expect(page.getByRole('heading', { name: '已选择 林雾' })).toBeVisible();
  await expect(page.getByRole('button', { name: '继续最近聊天' })).toBeEnabled();
  await expectNoHorizontalPageOverflow(page);
  await expect(page).toHaveScreenshot('homepage.png');
});

test('conversation drawer is a focus-managed dialog', async ({ page, seededApp }) => {
  expect(seededApp.conversationId).toBeTruthy();
  await openSeededHome(page);

  const trigger = primaryNavigation(page).getByRole('button', { name: '聊天记录', exact: true });
  await trigger.click();

  const drawer = page.getByRole('dialog', { name: '聊天记录' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('button', { name: '新聊天' })).toBeVisible();
  await expect
    .poll(() => drawer.evaluate((element) => element.contains(document.activeElement)))
    .toBe(true);

  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('library and utility drawers share close and focus behavior', async ({ page, seededApp }) => {
  expect(seededApp.characterId).toBeTruthy();
  await openSeededHome(page);

  const navigation = primaryNavigation(page);
  const cases = [
    { trigger: '角色', dialog: '角色' },
    { trigger: '用户设定', dialog: '用户设定' },
    { trigger: '世界书', dialog: '世界书' },
    { trigger: '预设', dialog: '预设' },
    { trigger: '工具箱', dialog: '工具箱' },
    { trigger: '设置', dialog: '设置' },
    { trigger: '提示词检查器', dialog: '检查器' }
  ] as const;

  for (const item of cases) {
    const trigger = navigation.getByRole('button', { name: item.trigger, exact: true });
    await trigger.click();

    const drawer = page.getByRole('dialog', { name: item.dialog, exact: true });
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute('data-testid', 'drawer-shell');

    if (item.dialog === '用户设定') {
      const identityPlane = drawer.locator('.persona-identity');
      await expect(identityPlane).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(identityPlane).toHaveCSS('border-radius', '0px');
      await expect(identityPlane).toHaveCSS('box-shadow', 'none');
    }

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
  }
});

test('chat workspace visual baseline and primary interaction', async ({ page, seededApp }) => {
  expect(seededApp.conversationId).toBeTruthy();
  await openSeededHome(page);
  await page.getByRole('button', { name: '继续最近聊天' }).click();

  const workspace = page.getByRole('region', { name: '聊天工作区' });
  await expect(workspace).toBeVisible();
  await expect(page.getByText('雨夜的第七站', { exact: true })).toBeVisible();
  await expect(page.getByText('那就跟紧我，钟楼后面有一条地图上没有的小路。', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '输入消息' })).toBeEditable();
  await expectNoHorizontalPageOverflow(page);
  await expect(page).toHaveScreenshot('chat-workspace.png');
});

test('character drawer visual baseline', async ({ page, seededApp }) => {
  expect(seededApp.characterId).toBeTruthy();
  await openSeededHome(page);
  await primaryNavigation(page).getByRole('button', { name: '角色', exact: true }).click();

  const drawer = page.getByRole('dialog', { name: '角色', exact: true });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('林雾', { exact: true }).first()).toBeVisible();
  await expect(drawer.getByRole('button', { name: '保存角色' })).toBeEnabled();
  const contentPlane = drawer.locator('.character-editor-section');
  await expect(contentPlane).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(contentPlane).toHaveCSS('border-radius', '0px');
  await expect(contentPlane).toHaveCSS('box-shadow', 'none');
  await page.mouse.move(1200, 900);
  await expect(page.locator('.rail-tooltip')).toBeHidden();
  await expectNoHorizontalPageOverflow(page);
  await expect(page).toHaveScreenshot('character-drawer.png');
});

test('worldbook drawer visual baseline', async ({ page, seededApp }) => {
  expect(seededApp.worldBookId).toBeTruthy();
  await openSeededHome(page);
  await primaryNavigation(page).getByRole('button', { name: '世界书', exact: true }).click();

  const drawer = page.getByRole('dialog', { name: '世界书', exact: true });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('textbox', { name: '名称', exact: true })).toHaveValue('南岸旧城档案');
  await expect(drawer.getByText('夜班电车', { exact: true }).first()).toBeVisible();
  await expect(drawer.getByRole('button', { name: '保存世界书' })).toBeEnabled();
  await page.mouse.move(1200, 900);
  await expect(page.locator('.rail-tooltip')).toBeHidden();
  await expectNoHorizontalPageOverflow(page);
  await expect(page).toHaveScreenshot('worldbook-drawer.png');
});

test('profile drawer visual baseline', async ({ page, seededApp }) => {
  expect(seededApp.conversationId).toBeTruthy();
  await openSeededHome(page);
  await primaryNavigation(page).getByRole('button', { name: '预设', exact: true }).click();

  const drawer = page.getByRole('dialog', { name: '预设', exact: true });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('region', { name: '预设摘要' })).toBeVisible();
  await expect(drawer.getByRole('button', { name: '保存修改' })).toBeEnabled();
  await page.mouse.move(1200, 900);
  await expect(page.locator('.rail-tooltip')).toBeHidden();
  await expectNoHorizontalPageOverflow(page);
  await expect(page).toHaveScreenshot('profile-drawer.png');
});
