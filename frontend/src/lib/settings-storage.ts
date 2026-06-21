'use client';

// 混淆存储键名，避免一眼识别
const STORAGE_KEY_CCODE_API = 'nova-api-key';
const STORAGE_KEY_CCODE_API_LEGACY = 'ccode-api-key';
const OBFUSCATION_MARKER = '__e:';

function getStorageItem(key: string): string {
  if (typeof window === 'undefined') return '';

  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function setStorageItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeStorageItem(key: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore unavailable storage.
  }
}

/**
 * 简单混淆：XOR 每个字符后 Base64 编码
 * 不是加密（客户端无法真正加密），但防止明文被一眼读取，增加 XSS 利用的成本
 */
function obfuscate(value: string): string {
  const chars: string[] = [];
  for (let i = 0; i < value.length; i++) {
    chars.push(String.fromCharCode(value.charCodeAt(i) ^ 0x5A));
  }
  return OBFUSCATION_MARKER + btoa(chars.join(''));
}

function deobfuscate(value: string): string | null {
  if (!value.startsWith(OBFUSCATION_MARKER)) return null;
  try {
    const decoded = atob(value.slice(OBFUSCATION_MARKER.length));
    const chars: string[] = [];
    for (let i = 0; i < decoded.length; i++) {
      chars.push(String.fromCharCode(decoded.charCodeAt(i) ^ 0x5A));
    }
    return chars.join('');
  } catch {
    return null;
  }
}

export function getStoredApiKey(): string {
  const obfuscated = getStorageItem(STORAGE_KEY_CCODE_API);
  if (obfuscated) {
    const result = deobfuscate(obfuscated);
    if (result !== null) return result;
  }
  // 向后兼容：尝试读取旧格式的明文 key，自动迁移
  const legacy = getStorageItem(STORAGE_KEY_CCODE_API_LEGACY);
  if (legacy) {
    setStoredApiKey(legacy);
    removeStorageItem(STORAGE_KEY_CCODE_API_LEGACY);
    return legacy;
  }
  return '';
}

export function setStoredApiKey(key: string): boolean {
  // 同时清理旧格式的明文 key
  removeStorageItem(STORAGE_KEY_CCODE_API_LEGACY);
  return setStorageItem(STORAGE_KEY_CCODE_API, obfuscate(key));
}

export function removeStoredApiKey(): void {
  removeStorageItem(STORAGE_KEY_CCODE_API);
  removeStorageItem(STORAGE_KEY_CCODE_API_LEGACY);
}

/** @deprecated Use getStoredApiKey instead */
export const getStoredCcodeKey = getStoredApiKey;
/** @deprecated Use setStoredApiKey instead */
export const setStoredCcodeKey = setStoredApiKey;
/** @deprecated Use removeStoredApiKey instead */
export const removeStoredCcodeKey = removeStoredApiKey;

export function getApiKeyFromStorage(): string {
  return getStoredApiKey();
}

export function hasAnyApiKey(): boolean {
  return !!getStoredApiKey();
}

// ===== 通用 JSON 持久化工具 =====

/**
 * 从 localStorage 读取并解析 JSON，失败返回空对象
 */
export function loadJsonFromStorage<T>(key: string): Partial<T> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * 将对象序列化为 JSON 写入 localStorage，忽略存储不可用或配额超限
 */
export function saveJsonToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage errors (private mode / quota)
  }
}
