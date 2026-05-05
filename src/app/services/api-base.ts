const RENDER_API_ORIGIN = 'https://tonggaw.onrender.com';

function isLocalhost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function resolveApiOrigin(): string {
  if (typeof window === 'undefined') {
    return RENDER_API_ORIGIN;
  }

  return isLocalhost(window.location.hostname) ? RENDER_API_ORIGIN : '';
}

export function buildApiUrl(path: string): string {
  return `${resolveApiOrigin()}${path}`;
}
