import { NextRequest, NextResponse } from 'next/server';
import { securityMiddleware } from '@/lib/security-middleware';
import { fetchRankingFromBackend, getRankingFallback } from '@/lib/ranking-api';
import { getRankingTab, type RankingTabId } from '@/lib/rankings-config';

/** Bắt buộc dynamic — không cache response theo path (tránh page=2 nhận data page=1) */
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

type RouteContext = { params: Promise<{ category: string }> };

function fallbackResponse(category: RankingTabId) {
  const tab = getRankingTab(category);
  const data = getRankingFallback(category);
  const reason = `Backend không phản hồi — kiểm tra terminal Next.js (log [ranking/${category}])`;
  console.error(`[ranking/${category}] ${reason}`);
  return NextResponse.json({
    success: true,
    data,
    message: `Dữ liệu mẫu — ${tab?.label ?? category} (backend chưa kết nối).`,
    meta: {
      source: 'fallback',
      category,
      reason,
    },
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { category } = await context.params;
  const tab = getRankingTab(category as RankingTabId);

  if (!tab) {
    return NextResponse.json({ success: false, message: 'Loại ranking không hợp lệ' }, { status: 404 });
  }

  try {
    let securityCheck: Awaited<ReturnType<typeof securityMiddleware>>;
    try {
      securityCheck = await securityMiddleware(request, `/api/rankings/${category}`);
    } catch {
      return fallbackResponse(category as RankingTabId);
    }

    if (securityCheck && !securityCheck.allowed) {
      return NextResponse.json(
        { success: false, message: securityCheck.error || 'Request không hợp lệ' },
        { status: securityCheck.statusCode || 400 }
      );
    }

    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1', 10) || 1);
    const result = await fetchRankingFromBackend(category as RankingTabId, page, { bypassCache: true });

    // Đảm bảo client nhận đúng số trang đã request (kèm data của trang đó)
    const payload = {
      ...result,
      data: Array.isArray(result.data) ? [...result.data] : result.data,
      pagination: result.pagination
        ? { ...result.pagination, page }
        : result.meta?.pagination
          ? { ...result.meta.pagination, page }
          : undefined,
      meta: {
        ...result.meta,
        pagination: result.pagination
          ? { ...result.pagination, page }
          : result.meta?.pagination
            ? { ...result.meta.pagination, page }
            : undefined,
      },
    };

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
        Vary: 'Accept-Encoding',
      },
    });
  } catch (error) {
    console.error(`[ranking/${category}] Exception:`, error);
    return fallbackResponse(category as RankingTabId);
  }
}
