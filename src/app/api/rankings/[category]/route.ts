import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/config/backend.config';
import { securityMiddleware } from '@/lib/security-middleware';
import { getRankingFallback } from '@/lib/ranking-api';
import { getRankingTab, type RankingTabId } from '@/lib/rankings-config';
import { guildMarkToDataUrl } from '@/lib/guild-mark';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

type RouteContext = { params: Promise<{ category: string }> };

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

function parsePage(request: NextRequest): number {
  // Dùng request.url gốc — tránh nextUrl searchParams bị lệch trên một số bản Next
  const fromUrl = new URL(request.url).searchParams.get('page');
  const n = parseInt(fromUrl || '1', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function transformCharacter(char: Record<string, unknown>) {
  return {
    account: String(char.AccountID ?? char.account ?? ''),
    character: String(char.Name ?? char.character ?? ''),
    class: Number(char.Class ?? char.class ?? 0),
    score: Number(char.Score ?? char.ResetCount ?? char.resets ?? char.score ?? 0),
    level: char.cLevel != null ? Number(char.cLevel) : char.level != null ? Number(char.level) : null,
    isOnline: (char.IsOnline ?? char.isOnline ?? 0) as number | boolean,
  };
}

function transformGuild(guild: Record<string, unknown>) {
  return {
    guildName: String(guild.G_Name ?? guild.guildName ?? ''),
    score: Number(guild.G_Score ?? guild.score ?? 0),
    guildMaster: String(guild.G_Master ?? guild.guildMaster ?? 'Unknown'),
    memberCount: Number(guild.G_Count ?? guild.MemberCount ?? guild.memberCount ?? 0),
    guildMark: guildMarkToDataUrl(guild.G_Mark ?? guild.guildMark),
  };
}

function fallbackResponse(category: RankingTabId) {
  const tab = getRankingTab(category);
  return NextResponse.json({
    success: true,
    data: getRankingFallback(category),
    message: `Dữ liệu mẫu — ${tab?.label ?? category} (backend chưa kết nối).`,
    meta: { source: 'fallback', category },
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { category } = await context.params;
  const tab = getRankingTab(category as RankingTabId);

  if (!tab) {
    return NextResponse.json({ success: false, message: 'Loại ranking không hợp lệ' }, { status: 404 });
  }

  const pageNum = parsePage(request);

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

    // Gọi backend trực tiếp — luôn kèm page + cache bust (không qua rankingCache module)
    const backendPath = `/api/rankings/${category}?page=${pageNum}&_cb=${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const backendUrl = getBackendUrl(backendPath);

    console.log(`[ranking/${category}] pageNum=${pageNum} → ${backendUrl}`);

    const backendResponse = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(10000),
    });

    const bodyText = await backendResponse.text();
    let backendData: {
      success?: boolean;
      data?: unknown[];
      message?: string;
      pagination?: Pagination;
    };

    try {
      backendData = JSON.parse(bodyText);
    } catch {
      console.error(`[ranking/${category}] Body không phải JSON (page=${pageNum})`);
      return fallbackResponse(category as RankingTabId);
    }

    if (!backendResponse.ok || !backendData.success || !Array.isArray(backendData.data)) {
      console.error(
        `[ranking/${category}] Backend lỗi page=${pageNum} HTTP ${backendResponse.status}: ${backendData.message ?? bodyText.slice(0, 120)}`
      );
      return fallbackResponse(category as RankingTabId);
    }

    const rows = backendData.data as Record<string, unknown>[];
    const data =
      category === 'guild' ? rows.map(transformGuild) : rows.map(transformCharacter);

    const pagination: Pagination = backendData.pagination
      ? { ...backendData.pagination, page: pageNum }
      : {
          page: pageNum,
          limit: data.length || 50,
          total: data.length,
          totalPages: 1,
        };

    console.log(
      `[ranking/${category}] OK page=${pageNum} first=${
        category === 'guild'
          ? (data[0] as { guildName?: string })?.guildName
          : (data[0] as { character?: string })?.character
      } rows=${data.length}`
    );

    return NextResponse.json(
      {
        success: true,
        data,
        pagination,
        message: backendData.message ?? 'Lấy danh sách ranking từ database.',
        meta: {
          source: 'database',
          category,
          backendUrl,
          rowCount: data.length,
          page: pageNum,
          pagination,
        },
      },
      {
        headers: {
          'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error) {
    console.error(`[ranking/${category}] Exception page=${pageNum}:`, error);
    return fallbackResponse(category as RankingTabId);
  }
}
