/**
 * MyDearPartner — Environment Configuration
 *
 * Production backend: Django at https://mydearpartner.in
 * Discovered from: /opt/mydearpartner/.env on srv1833582
 *
 * NEVER commit secrets (tokens, passwords) to this file.
 */

type Env = {
  API_BASE_URL: string;
  WS_BASE_URL: string;
  MEDIA_BASE_URL: string;
  APP_NAME: string;
};

const development: Env = {
  API_BASE_URL: 'https://mydearpartner.in/api/v1',
  WS_BASE_URL: 'wss://mydearpartner.in/ws/',
  MEDIA_BASE_URL: 'https://mydearpartner.in/media',
  APP_NAME: 'My Dear Partner (Dev)',
};

/**
 * Production — Hostinger VPS: srv1833582
 * BACKEND_URL: https://mydearpartner.in
 * NEXT_PUBLIC_API_BASE_URL: /api/v1
 * NEXT_PUBLIC_WS_BASE_URL: wss://mydearpartner.in/ws/
 * NEXT_PUBLIC_MEDIA_BASE_URL: https://mydearpartner.in/media
 */
const production: Env = {
  API_BASE_URL: 'https://mydearpartner.in/api/v1',
  WS_BASE_URL: 'wss://mydearpartner.in/ws/',
  MEDIA_BASE_URL: 'https://mydearpartner.in/media',
  APP_NAME: 'My Dear Partner',
};

const ENV: Env = __DEV__ ? development : production;

export const { API_BASE_URL, WS_BASE_URL, MEDIA_BASE_URL, APP_NAME } = ENV;
export default ENV;
