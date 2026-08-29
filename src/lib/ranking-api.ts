import { getBackendUrl, getBackendBaseUrl } from '@/config/backend.config';
import { guildMarkToDataUrl } from '@/lib/guild-mark';
import { RANKING_GUILD_FALLBACK, RANKING_LEVEL_FALLBACK } from '@/lib/ranking-fallback-data';
import type { RankingTabId } from '@/lib/rankings-config';

export type CharacterRankingRow = {
  account: string;
  character: string;
  class: number;
  score: number;
  level?: number | null;
  isOnline?: number | boolean;
};

export type GuildRankingRow = {
  guildName: string;
  score: number;
  guildMaster: string;
  memberCount: number;
  guildMark?: string | null;
};

export type RankingPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type RankingMeta = {
  source: 'database' | 'fallback';
  category: RankingTabId;
  backendUrl?: string;
  rowCount?: number;
  reason?: string;
  triedUrls?: string[];
  pagination?: RankingPagination;
};

const FETCH_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 120_000;
const STALE_TTL_MS = 10 * 60_000;
const FALLBACK_CACHE_TTL_MS = 30_000;

type RankingFetchResult = {
  success: boolean;
  data: CharacterRankingRow[] | GuildRankingRow[];
  message?: string;
  meta: RankingMeta;
  pagination?: RankingPagination;
};

function cacheKey(category: RankingTabId, page: number) {
  return `${category}:${page}`;
}

const rankingCache = new Map<string, { result: RankingFetchResult; fetchedAt: number }>();
const rankingInflight = new Map<string, Promise<RankingFetchResult>>();

function cloneRankingResult(result: RankingFetchResult, message?: string): RankingFetchResult {
  return {
    ...result,
    message: message ?? result.message,
    meta: { ...result.meta },
  };
}

const CHARACTER_ENDPOINTS: RankingTabId[] = [
  'level',
  'killers',
  'online',
  'blood-castle',
  'devil-square',
  'chaos-castle',
  'kundun',
  'erohim',
  'red-dragon',
];

function transformCharacterRow(char: Record<string, unknown>): CharacterRankingRow {
  return {
    account: String(char.AccountID ?? char.account ?? ''),
    character: String(char.Name ?? char.character ?? ''),
    class: Number(char.Class ?? char.class ?? 0),
    score: Number(char.Score ?? char.ResetCount ?? char.resets ?? char.score ?? 0),
    level: char.cLevel != null ? Number(char.cLevel) : char.level != null ? Number(char.level) : null,
    isOnline: (char.IsOnline ?? char.isOnline ?? 0) as number | boolean,
  };
}

function transformGuildRow(guild: Record<string, unknown>): GuildRankingRow {
  const rawMark = guild.G_Mark ?? guild.guildMark;
  const memberCount = Number(
    guild.G_Count ?? guild.MemberCount ?? guild.memberCount ?? 0
  );
  return {
    guildName: String(guild.G_Name ?? guild.guildName ?? ''),
    score: Number(guild.G_Score ?? guild.score ?? 0),
    guildMaster: String(guild.G_Master ?? guild.guildMaster ?? 'Unknown'),
    memberCount,
    guildMark: guildMarkToDataUrl(rawMark),
  };
}

function getBackendCandidates(category: RankingTabId, page: number): string[] {
  const qs = `?page=${Math.max(1, page)}`;
  const primary = getBackendUrl(`/api/rankings/${category}${qs}`);
  const urls = [primary];

  const isDev = process.env.NODE_ENV === 'development';
  const local = `http://127.0.0.1:3001/api/rankings/${category}${qs}`;
  if (isDev && !primary.includes('127.0.0.1') && !primary.includes('localhost')) {
    urls.push(local);
  }

  return [...new Set(urls)];
}

function formatFetchError(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: Error }).cause;
    if (cause instanceof Error) return `${error.message} — ${cause.message}`;
    return error.message;
  }
  return String(error);
}

async function fetchRankingFromBackendOnce(category: RankingTabId, page = 1): Promise<RankingFetchResult> {
  const triedUrls = getBackendCandidates(category, page);
  const errors: string[] = [];

  for (const url of triedUrls) {
    try {
      console.log(`[ranking/${category}] Đang gọi backend: ${url}`);

      const backendResponse = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      const bodyText = await backendResponse.text();
      let backendData: {
        success?: boolean;
        data?: unknown;
        message?: string;
        pagination?: RankingPagination;
      };

      try {
        backendData = JSON.parse(bodyText);
      } catch {
        errors.push(`${url} → HTTP ${backendResponse.status}, body không phải JSON`);
        console.warn(`[ranking/${category}] ${errors[errors.length - 1]}`);
        continue;
      }

      if (!backendResponse.ok) {
        const msg = `${url} → HTTP ${backendResponse.status}: ${backendData.message ?? bodyText.slice(0, 120)}`;
        errors.push(msg);
        console.warn(`[ranking/${category}] ${msg}`);
        continue;
      }

      if (!backendData.success || !Array.isArray(backendData.data)) {
        const msg = `${url} → response không hợp lệ (success=${backendData.success})`;
        errors.push(msg);
        console.warn(`[ranking/${category}] ${msg}`);
        continue;
      }

      const rowCount = backendData.data.length;
      console.log(`[ranking/${category}] OK — ${rowCount} dòng từ ${url}`);

      const meta: RankingMeta = {
        source: 'database',
        category,
        backendUrl: url,
        rowCount,
        triedUrls,
        pagination: backendData.pagination,
      };

      if (category === 'guild') {
        return {
          success: true,
          data: backendData.data.map((row: Record<string, unknown>) => transformGuildRow(row)),
          message: backendData.message ?? 'Lấy danh sách guild ranking từ database.',
          meta,
          pagination: backendData.pagination,
        };
      }

      return {
        success: true,
        data: backendData.data.map((row: Record<string, unknown>) => transformCharacterRow(row)),
        message: backendData.message ?? 'Lấy danh sách ranking từ database.',
        meta,
        pagination: backendData.pagination,
      };
    } catch (error) {
      const msg = `${url} → ${formatFetchError(error)}`;
      errors.push(msg);
      console.warn(`[ranking/${category}] ${msg}`);
    }
  }

  const reason = errors.join(' | ') || 'Không gọi được backend';
  console.error(`[ranking/${category}] FALLBACK dữ liệu mẫu. Lý do: ${reason}`);
  console.error(
    `[ranking/${category}] Gợi ý: chạy backend (cd backend && npm run dev), cấu hình DB trong backend/.env, đặt NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3001 trong .env.local`
  );

  return {
    success: true,
    data: getRankingFallback(category),
    message: `Dữ liệu mẫu — không lấy được từ database. Backend: ${getBackendBaseUrl()}`,
    meta: {
      source: 'fallback',
      category,
      backendUrl: triedUrls[0],
      reason,
      triedUrls,
    },
  };
}

export async function fetchRankingFromBackend(
  category: RankingTabId,
  page = 1,
  options?: { bypassCache?: boolean }
): Promise<RankingFetchResult> {
  const now = Date.now();
  const key = cacheKey(category, page);
  const bypassCache = options?.bypassCache === true;
  const cached = bypassCache ? undefined : rankingCache.get(key);

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cloneRankingResult(cached.result);
  }

  if (!bypassCache) {
    const inflight = rankingInflight.get(key);
    if (inflight) {
      return inflight;
    }
  }

  const request = fetchRankingFromBackendOnce(category, page)
    .then((result) => {
      if (result.meta.source === 'database') {
        rankingCache.set(key, { result, fetchedAt: Date.now() });
        return result;
      }

      if (cached && now - cached.fetchedAt < STALE_TTL_MS && cached.result.meta.source === 'database') {
        console.warn(
          `[ranking/${category}] Backend lỗi (${result.meta.reason ?? 'unknown'}) — dùng cache ${cached.result.data.length} dòng`
        );
        return cloneRankingResult(
          cached.result,
          'Dữ liệu cache — backend tạm thời không phản hồi (thường do HTTP 429).'
        );
      }

      if (cached && now - cached.fetchedAt < FALLBACK_CACHE_TTL_MS) {
        return cloneRankingResult(cached.result, result.message);
      }

      rankingCache.set(key, { result, fetchedAt: Date.now() });
      return result;
    })
    .finally(() => {
      rankingInflight.delete(key);
    });

  if (!bypassCache) {
    rankingInflight.set(key, request);
  }
  return request;
}

export function getRankingFallback(category: RankingTabId): CharacterRankingRow[] | GuildRankingRow[] {
  if (category === 'guild') {
    return RANKING_GUILD_FALLBACK.map((g) => ({
      guildName: g.guildName,
      score: g.score,
      guildMaster: g.guildMaster,
      memberCount: g.memberCount,
      guildMark: g.guildMark,
    }));
  }

  return RANKING_LEVEL_FALLBACK.map((c) => ({
    account: c.account,
    character: c.character,
    class: c.class,
    score: category === 'level' ? c.resets : Math.max(0, 50 - c.resets),
    level: c.level,
    isOnline: c.isOnline,
  }));
}

export function isCharacterRankingCategory(category: string): category is RankingTabId {
  return CHARACTER_ENDPOINTS.includes(category as RankingTabId) || category === 'level';
}
