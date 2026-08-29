import type { StatsBoost } from '@/lib/config-api';

export interface ServerStats {
  totalAccounts: number;
  totalCharacters: number;
  totalGuilds: number;
  onlinePlayers: number;
}

export interface StatsApiResponse {
  success?: boolean;
  data?: Partial<ServerStats> & { onlineCount?: number };
  meta?: {
    real?: Partial<ServerStats> & { onlineCount?: number };
    boost?: Partial<ServerStats>;
  };
}

function statNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function readOnline(base: Partial<ServerStats> & { onlineCount?: number }): number {
  return statNum(base.onlinePlayers ?? base.onlineCount);
}

/** Hiển thị = số DB (meta.real) + statsBoost config — cả 4 chỉ số đều cộng. */
export function mergeDisplayStats(
  api: StatsApiResponse | null | undefined,
  boost?: StatsBoost | null
): ServerStats | null {
  if (!api?.success || !api.data) return null;

  const base = api.meta?.real ?? api.data;
  const b = boost ?? {};

  return {
    totalAccounts: statNum(base.totalAccounts) + statNum(b.totalAccounts),
    totalCharacters: statNum(base.totalCharacters) + statNum(b.totalCharacters),
    totalGuilds: statNum(base.totalGuilds) + statNum(b.totalGuilds),
    onlinePlayers: readOnline(base) + statNum(b.onlinePlayers),
  };
}

/** Fallback khi API lỗi — dùng toàn bộ statsBoost */
export function statsFromBoostOnly(boost?: StatsBoost | null): ServerStats | null {
  if (!boost) return null;
  const totalAccounts = statNum(boost.totalAccounts);
  const totalCharacters = statNum(boost.totalCharacters);
  const totalGuilds = statNum(boost.totalGuilds);
  const onlinePlayers = statNum(boost.onlinePlayers);
  if (totalAccounts + totalCharacters + totalGuilds + onlinePlayers <= 0) return null;
  return { totalAccounts, totalCharacters, totalGuilds, onlinePlayers };
}
