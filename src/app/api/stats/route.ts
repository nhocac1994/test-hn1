import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/config/backend.config';

export async function GET(_request: NextRequest) {
  try {
    const backendResponse = await fetch(getBackendUrl('/api/stats'), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    const data = await backendResponse.json();
    if (!backendResponse.ok) {
      return NextResponse.json(
        { success: false, message: data.message || 'Không lấy được thống kê server' },
        { status: backendResponse.status }
      );
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('[api/stats]', error);
    return NextResponse.json(
      { success: false, message: 'Lỗi kết nối thống kê server' },
      { status: 503 }
    );
  }
}
