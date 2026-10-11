export const CURRENT_APP_VERSION = '3.0.91';

export interface VersionInfo {
  version: string;
  releaseNotes?: string;
  downloadUrl?: string;
  forceUpdate?: boolean;
}

// iOS Safari 在禁用 Cookie / 部分独立模式下访问 localStorage 会直接抛错，
// 这里放模块顶层会连整个 App 都加载不了，所以必须兜住。
function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

const DEFAULT_UPDATE_MANIFEST_URL = safeLocalStorageGet('miu_update_check_url') || 'https://raw.githubusercontent.com/fanye0220/APP/main/version.json';

export function getUpdateManifestUrl(): string {
  return safeLocalStorageGet('miu_update_check_url') || DEFAULT_UPDATE_MANIFEST_URL;
}

export function setUpdateManifestUrl(url: string): void {
  if (!url) {
    localStorage.removeItem('miu_update_check_url');
  } else {
    localStorage.setItem('miu_update_check_url', url.trim());
  }
}

export function compareVersions(v1: string, v2: string): number {
  const cleanV1 = v1.replace(/^v/i, '').trim();
  const cleanV2 = v2.replace(/^v/i, '').trim();
  
  const p1 = cleanV1.split('.').map(n => parseInt(n, 10) || 0);
  const p2 = cleanV2.split('.').map(n => parseInt(n, 10) || 0);

  const len = Math.max(p1.length, p2.length);
  for (let i = 0; i < len; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

export async function checkForAppUpdates(customUrl?: string): Promise<{
  hasUpdate: boolean;
  latestVersion?: VersionInfo;
  error?: string;
}> {
  const checkUrl = customUrl || getUpdateManifestUrl();
  try {
    const res = await fetch(checkUrl, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}`);
    }
    const data: VersionInfo = await res.json();
    if (!data || !data.version) {
      throw new Error('无效的版本信息文件');
    }

    const hasUpdate = compareVersions(data.version, CURRENT_APP_VERSION) > 0;
    return {
      hasUpdate,
      latestVersion: data
    };
  } catch (err: any) {
    console.warn('Check update failed:', err);
    return {
      hasUpdate: false,
      error: err.message || '检查更新失败'
    };
  }
}
