import { t } from '$lib/i18n';

export type AppFontFamily =
  | 'system'
  | 'lxgw-wenkai'
  | 'noto-sans-sc'
  | 'noto-serif-sc'
  | 'source-han-sans'
  | 'source-han-serif'
  | 'serif'
  | 'mono';

export type AppAvatarShape = 'square' | 'rectangle' | 'circle';

export type AppSettings = {
  fontFamily: AppFontFamily;
  chatFontFamily: AppFontFamily;
  fontWeight: number;
  uiFontSize: number;
  chatFontSize: number;
  chatBubbleWidth: number;
  avatarShape: AppAvatarShape;
};

export type AppFontOption = {
  value: AppFontFamily;
  label: string;
  description: string;
  css: string;
};

export type AppAvatarShapeOption = {
  value: AppAvatarShape;
  label: string;
  description: string;
};

const storageKey = 'nanke.interface-settings.v1';

export const settingsPreviewAvatarUrl = '/brand/settings-preview-ant.png';

export const appAvatarShapes: AppAvatarShapeOption[] = [
  { value: 'square', label: t('avatarShape.square'), description: t('avatarShape.squareDescription') },
  { value: 'rectangle', label: t('avatarShape.rectangle'), description: t('avatarShape.rectangleDescription') },
  { value: 'circle', label: t('avatarShape.circle'), description: t('avatarShape.circleDescription') }
];

export const appFontFamilies: AppFontOption[] = [
  {
    value: 'system',
    label: t('font.system'),
    description: t('font.systemDescription'),
    css: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  {
    value: 'lxgw-wenkai',
    label: '霞鹜文楷',
    description: t('font.lxgwWenkaiDescription'),
    css: '"LXGW WenKai Screen", "LXGW WenKai", "霞鹜文楷", "Kaiti SC", KaiTi, serif'
  },
  {
    value: 'noto-sans-sc',
    label: 'Noto Sans SC',
    description: t('font.notoSansScDescription'),
    css: '"Noto Sans SC", "Noto Sans CJK SC", "Source Han Sans SC", "Source Han Sans CN", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif'
  },
  {
    value: 'noto-serif-sc',
    label: 'Noto Serif SC',
    description: t('font.notoSerifScDescription'),
    css: '"Noto Serif SC", "Noto Serif CJK SC", "Source Han Serif SC", "Source Han Serif CN", "Songti SC", serif'
  },
  {
    value: 'source-han-sans',
    label: '思源黑体',
    description: t('font.sourceHanSansDescription'),
    css: '"Source Han Sans SC", "Source Han Sans CN", "Noto Sans CJK SC", "思源黑体", "Microsoft YaHei", sans-serif'
  },
  {
    value: 'source-han-serif',
    label: '思源宋体',
    description: t('font.sourceHanSerifDescription'),
    css: '"Source Han Serif SC", "Source Han Serif CN", "Noto Serif CJK SC", "思源宋体", "Songti SC", serif'
  },
  {
    value: 'serif',
    label: t('font.serif'),
    description: t('font.serifDescription'),
    css: 'Georgia, "Times New Roman", ui-serif, serif'
  },
  {
    value: 'mono',
    label: t('font.mono'),
    description: t('font.monoDescription'),
    css: '"Cascadia Code", "SFMono-Regular", Consolas, ui-monospace, monospace'
  }
];

export function defaultAppSettings(): AppSettings {
  return {
    fontFamily: 'system',
    chatFontFamily: 'system',
    fontWeight: 450,
    uiFontSize: 14,
    chatFontSize: 15,
    chatBubbleWidth: 760,
    avatarShape: 'rectangle'
  };
}

function appFontFamilyCss(value: AppFontFamily) {
  return appFontFamilies.find((font) => font.value === value)?.css ?? appFontFamilies[0].css;
}

function clampSetting(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function isAppFontFamily(value: unknown): value is AppFontFamily {
  return appFontFamilies.some((font) => font.value === value);
}

function isAppAvatarShape(value: unknown): value is AppAvatarShape {
  return appAvatarShapes.some((shape) => shape.value === value);
}

function avatarShapeVariables(shape: AppAvatarShape): Record<string, string> {
  if (shape === 'rectangle') {
    return {
      '--app-message-avatar-width': '52px',
      '--app-message-avatar-height': '64px',
      '--app-message-avatar-radius': '10px'
    };
  }
  if (shape === 'circle') {
    return {
      '--app-message-avatar-width': '56px',
      '--app-message-avatar-height': '56px',
      '--app-message-avatar-radius': '999px'
    };
  }
  return {
    '--app-message-avatar-width': '56px',
    '--app-message-avatar-height': '56px',
    '--app-message-avatar-radius': '10px'
  };
}

export function appSettingsVariables(settings: AppSettings): Record<string, string> {
  return {
    '--app-font-family': appFontFamilyCss(settings.fontFamily),
    '--app-chat-font-family': appFontFamilyCss(settings.chatFontFamily),
    '--app-font-weight': String(settings.fontWeight),
    '--app-ui-font-size': `${settings.uiFontSize}px`,
    '--app-chat-font-size': `${settings.chatFontSize}px`,
    '--app-chat-bubble-width': `${settings.chatBubbleWidth}px`,
    ...avatarShapeVariables(settings.avatarShape)
  };
}

export function serializeAppSettingsVariables(settings: AppSettings) {
  return Object.entries(appSettingsVariables(settings))
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ');
}

export function applyAppSettingsToDocument(settings: AppSettings) {
  if (typeof document === 'undefined') return;
  for (const [name, value] of Object.entries(appSettingsVariables(settings))) {
    document.documentElement.style.setProperty(name, value);
  }
}

export function normalizeAppSettings(value: Partial<AppSettings> | null | undefined): AppSettings {
  const defaults = defaultAppSettings();
  const candidateFontFamily = value?.fontFamily;
  const fontFamily = isAppFontFamily(candidateFontFamily) ? candidateFontFamily : defaults.fontFamily;
  const candidateChatFontFamily = value?.chatFontFamily;
  const chatFontFamily = isAppFontFamily(candidateChatFontFamily) ? candidateChatFontFamily : fontFamily;
  const candidateAvatarShape = value?.avatarShape;
  return {
    fontFamily,
    chatFontFamily,
    fontWeight: clampSetting(value?.fontWeight, 350, 650, defaults.fontWeight),
    uiFontSize: clampSetting(value?.uiFontSize, 12, 18, defaults.uiFontSize),
    chatFontSize: clampSetting(value?.chatFontSize, 13, 24, defaults.chatFontSize),
    chatBubbleWidth: clampSetting(value?.chatBubbleWidth, 420, 1000, defaults.chatBubbleWidth),
    avatarShape: isAppAvatarShape(candidateAvatarShape) ? candidateAvatarShape : defaults.avatarShape
  };
}

export function readAppSettings(storage: Pick<Storage, 'getItem'>): AppSettings {
  try {
    const raw = storage.getItem(storageKey);
    return raw ? normalizeAppSettings(JSON.parse(raw) as Partial<AppSettings>) : defaultAppSettings();
  } catch {
    return defaultAppSettings();
  }
}

export function persistAppSettings(storage: Pick<Storage, 'setItem'>, value: AppSettings): AppSettings {
  const normalized = normalizeAppSettings(value);
  storage.setItem(storageKey, JSON.stringify(normalized));
  return normalized;
}
