// packages/static-crypt/src/fragment.mjs

/**
 * Base64url encode
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function base64urlEncode(bytes) {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Base64url decode
 * @param {string} str
 * @returns {Uint8Array}
 */
function base64urlDecode(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  return new Uint8Array([...binary].map(c => c.charCodeAt(0)));
}

/**
 * Parse URL fragment to extract tier and key
 * @param {string} fragment - URL fragment including #
 * @returns {{tier: string, key: Uint8Array} | null}
 */
export function parseFragment(fragment) {
  if (!fragment || !fragment.startsWith('#')) return null;

  const params = new URLSearchParams(fragment.slice(1));
  const tier = params.get('t');
  const keyStr = params.get('k');

  if (!tier || !keyStr) return null;

  try {
    const key = base64urlDecode(keyStr);
    if (key.length !== 32) return null;
    return { tier, key };
  } catch {
    return null;
  }
}

/**
 * Build URL fragment from tier and key
 * @param {string} tier
 * @param {Uint8Array} key
 * @returns {string}
 */
export function buildFragment(tier, key) {
  const keyStr = base64urlEncode(key);
  return `#t=${encodeURIComponent(tier)}&k=${keyStr}`;
}

/**
 * Get key from current window location fragment (browser only)
 * @returns {{tier: string, key: Uint8Array} | null}
 */
export function getKeyFromFragment() {
  if (typeof window === 'undefined') return null;
  return parseFragment(window.location.hash);
}

const STORAGE_PREFIX = 'static-crypt-';

/**
 * Persist key to localStorage
 * @param {string} tier
 * @param {Uint8Array} key
 */
export function persistKey(tier, key) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(`${STORAGE_PREFIX}tier`, tier);
  localStorage.setItem(`${STORAGE_PREFIX}key`, base64urlEncode(key));
}

/**
 * Load persisted key from localStorage
 * @returns {{tier: string, key: Uint8Array} | null}
 */
export function loadPersistedKey() {
  if (typeof localStorage === 'undefined') return null;
  const tier = localStorage.getItem(`${STORAGE_PREFIX}tier`);
  const keyStr = localStorage.getItem(`${STORAGE_PREFIX}key`);
  if (!tier || !keyStr) return null;
  try {
    return { tier, key: base64urlDecode(keyStr) };
  } catch {
    return null;
  }
}

/**
 * Clear persisted key from localStorage
 */
export function clearPersistedKey() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(`${STORAGE_PREFIX}tier`);
  localStorage.removeItem(`${STORAGE_PREFIX}key`);
}
