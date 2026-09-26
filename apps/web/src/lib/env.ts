/** Base URL of the API. Empty in development, where Vite proxies /api to the local server. */
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
export const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL as string | undefined) ?? (API_URL || undefined);
export const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined) ?? window.location.origin;
