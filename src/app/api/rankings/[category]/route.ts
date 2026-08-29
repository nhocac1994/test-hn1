import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { securityMiddleware } from '@/lib/security-middleware';
import { fetchRankingFromBackend, getRankingFallback } from '@/lib/ranking-api';
import { getRankingTab, type RankingTabId } from '@/lib/rankings-config';

type RouteContext = { params: Promise<{ category: string }> };

const RANKING_CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=90, stale-while-revalidate=180',
};

function getCachedRanking(category: RankingTabId, page: number) {
  return unstable_cache(
    () => fetchRankingFromBackend(category, page),
    ['ranking', category, String(page)],
    { revalidate: 90 }
  )();
}

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
    const result = await getCachedRanking(category as RankingTabId, page);
    return NextResponse.json(result, { headers: RANKING_CACHE_HEADERS });
  } catch (error) {
    console.error(`[ranking/${category}] Exception:`, error);
    return fallbackResponse(category as RankingTabId);
  }
}
