/**
 * URL-safe Base64 encoder and decoder for Organization IDs.
 * Allows short, clean URLs like:
 *   /LVAzLTFzQ3JCM2VBWVFlTHZfRGo
 * instead of raw IDs or complex query params.
 */

export function encodeOrgId(id: string): string {
  if (!id) return '';
  try {
    if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
      return window.btoa(unescape(encodeURIComponent(id)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }
    return Buffer.from(id).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch {
    return id;
  }
}

export function decodeOrgId(str: string): string {
  if (!str) return '';
  // If it already starts with a hyphen (Firebase push ID, e.g. -P3-...), return directly
  if (str.startsWith('-')) return str;
  try {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      const decoded = decodeURIComponent(escape(window.atob(base64)));
      if (decoded && (decoded.startsWith('-') || decoded.length > 5)) {
        return decoded;
      }
    } else {
      const decoded = Buffer.from(base64, 'base64').toString('utf8');
      if (decoded && (decoded.startsWith('-') || decoded.length > 5)) {
        return decoded;
      }
    }
    return str;
  } catch {
    return str;
  }
}

export function isReservedRoute(token: string): boolean {
  if (!token) return true;
  const reserved = new Set([
    'dashboard', 'contacts', 'organizations', 'profile', 'settings',
    'login', 'register', 'api', 'icons', 'sw.js', 'manifest.webmanifest',
    'manifest.json', 'favicon.ico', '_next', 'default'
  ]);
  return reserved.has(token.toLowerCase());
}
