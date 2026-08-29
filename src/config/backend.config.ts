// Backend API Configuration
// URL của Backend API Server — đặt trong .env.local hoặc Vercel Environment Variables:
// NEXT_PUBLIC_BACKEND_API_URL=https://your-backend-host:port
const DEFAULT_BACKEND_URL = 'http://103.77.174.211:55666';

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * Luôn đọc lại env mỗi lần (tránh bundle client cũ giữ URL backend sai).
 * next.config.ts cũng set env.NEXT_PUBLIC_BACKEND_API_URL mặc định khi thiếu .env.local.
 */
function resolveBackendBase(): string {
  const raw =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BACKEND_API_URL
      ? String(process.env.NEXT_PUBLIC_BACKEND_API_URL).trim()
      : '';
  if (raw) return normalizeBaseUrl(raw);
  return normalizeBaseUrl(DEFAULT_BACKEND_URL);
}

/** @deprecated Dùng getBackendUrl() — giá trị này chỉ phản ánh lúc module load */
export const BACKEND_API_URL = resolveBackendBase();

/** Base URL backend (không có path) — dùng cho client kiểu `base + '/api/...'` */
export function getBackendBaseUrl(): string {
  return normalizeBaseUrl(resolveBackendBase());
}

/**
 * Lấy URL đầy đủ cho backend API endpoint
 * @param endpoint - API endpoint (ví dụ: '/api/auth/login')
 * @returns URL đầy đủ
 */
export const getBackendUrl = (endpoint: string): string => {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const base = normalizeBaseUrl(resolveBackendBase());
  return `${base}${normalizedEndpoint}`;
};

/**
 * Helper function để gọi backend API với error handling
 */
export const callBackendAPI = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const url = getBackendUrl(endpoint);
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  return fetch(url, defaultOptions);
};

