import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/config/backend.config';
import { buildRemoteFallback } from '@/lib/remote-fallback';

/** Chỉ proxy các path backend — tránh open proxy */
const ALLOWED_GET_PATHS = new Set([
  'config',
  'config/download',
  'config/events',
  'config/social',
  'config/bank',
  'config/server',
  'stats',
]);

function isNewsGetPath(normalized: string): boolean {
  return normalized === 'news' || /^news\/[a-z0-9-]+$/.test(normalized);
}

const BACKEND_TIMEOUT_MS = 8000;

function fallbackResponse(normalized: string, reason: string): NextResponse {
  const payload = buildRemoteFallback(normalized);
  if (payload) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[api/remote] Fallback local (${reason}): /api/${normalized}`);
    }
    return NextResponse.json(payload, {
      status: 200,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  }
  return NextResponse.json(
    { success: false, message: 'Không kết nối được backend' },
    { status: 502 }
  );
}

/**
 * GET /api/remote/config[...] | news[...] → backend (fallback file local nếu backend lỗi)
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { path: segments = [] } = await context.params;
  const normalized = segments.join('/');
  if (!normalized || (!ALLOWED_GET_PATHS.has(normalized) && !isNewsGetPath(normalized))) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const backendUrl = getBackendUrl(`/api/${normalized}`);

  try {
    const backendResponse = await fetch(backendUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
    });

    if (!backendResponse.ok) {
      return fallbackResponse(normalized, `HTTP ${backendResponse.status}`);
    }

    const text = await backendResponse.text();
    return new NextResponse(text, {
      status: backendResponse.status,
      headers: {
        'Content-Type': backendResponse.headers.get('Content-Type') || 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[api/remote] Backend unreachable:', backendUrl, e);
    }
    return fallbackResponse(normalized, 'network');
  }
}
