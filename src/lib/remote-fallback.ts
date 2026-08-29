import fs from 'fs';
import path from 'path';
import siteConfigStatic from '@/config/site.config.json';

function readJsonFile<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

/** Config runtime từ backend local (nếu có) hoặc site.config.json */
export function getLocalSiteConfig(): Record<string, unknown> {
  const fromBackend = readJsonFile<Record<string, unknown>>(
    path.join(process.cwd(), 'backend/config/site-config.json')
  );
  if (fromBackend) return fromBackend;

  const s = siteConfigStatic as Record<string, unknown>;
  const dl = (s.downloadLinks ?? {}) as Record<string, string>;
  return {
    ...s,
    events: [],
    downloadLinks: dl,
    socialMedia: {
      facebook: s.linkFacebook,
      youtube: s.linkYoutube,
      discord: s.linkDiscord,
      zalo: s.linkZalo,
      tiktok: s.linkTikTok,
    },
    bankTransfer: s.bankTransfer ?? {},
    statsBoost: fromBackend?.statsBoost ?? s.statsBoost ?? {},
    serverInfo: {
      name: s.serverName ?? s.nameGame,
      version: s.serverVersion ?? 'Season 1',
      expRate: s.expRate ?? 'x100',
      dropRate: s.dropRate ?? 'x50',
    },
  };
}

export function getLocalNewsList(): unknown[] {
  const file = readJsonFile<{ articles?: unknown[] }>(
    path.join(process.cwd(), 'backend/config/news.json')
  );
  if (!file?.articles) return [];
  return file.articles
    .filter((a) => (a as { published?: boolean }).published !== false)
    .sort(
      (a, b) =>
        ((a as { sortOrder?: number }).sortOrder ?? 0) -
        ((b as { sortOrder?: number }).sortOrder ?? 0)
    );
}

export function getLocalNewsArticle(slug: string): unknown | null {
  const file = readJsonFile<{ articles?: Record<string, unknown>[] }>(
    path.join(process.cwd(), 'backend/config/news.json')
  );
  const article = file?.articles?.find((a) => a.slug === slug && a.published !== false);
  return article ?? null;
}

export function buildRemoteFallback(normalizedPath: string): { success: boolean; data: unknown } | null {
  const cfg = getLocalSiteConfig();

  if (normalizedPath === 'config') {
    return { success: true, data: cfg };
  }
  if (normalizedPath === 'config/events') {
    return { success: true, data: cfg.events ?? [] };
  }
  if (normalizedPath === 'config/download') {
    return { success: true, data: cfg.downloadLinks ?? {} };
  }
  if (normalizedPath === 'config/social') {
    return { success: true, data: cfg.socialMedia ?? {} };
  }
  if (normalizedPath === 'config/bank') {
    return { success: true, data: cfg.bankTransfer ?? {} };
  }
  if (normalizedPath === 'config/server') {
    return { success: true, data: cfg.serverInfo ?? {} };
  }
  if (normalizedPath === 'stats') {
    const zero = {
      totalAccounts: 0,
      totalCharacters: 0,
      totalGuilds: 0,
      onlinePlayers: 0,
    };
    return {
      success: true,
      data: zero,
      meta: { real: zero, dbError: true },
    };
  }
  if (normalizedPath === 'news') {
    return { success: true, data: getLocalNewsList() };
  }
  if (normalizedPath.startsWith('news/')) {
    const slug = normalizedPath.slice('news/'.length);
    const article = getLocalNewsArticle(slug);
    if (!article) return null;
    return { success: true, data: article };
  }
  return null;
}
