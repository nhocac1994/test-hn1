/** Origin nội bộ để server gọi chính proxy Next (fetch Node cần URL tuyệt đối) */
function getAppOriginForServerFetch(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL_URL?.trim()) return `https://${process.env.VERCEL_URL}`;
  const port = process.env.PORT || '3000';
  return `http://127.0.0.1:${port}`;
}

function isBrowser(): boolean {
  return typeof globalThis !== 'undefined' && typeof (globalThis as { document?: unknown }).document !== 'undefined';
}

/**
 * Config từ backend: luôn qua proxy Next `/api/remote/...`.
 * Không import getBackendUrl ở đây — tránh nhúng `http://...` vào bundle client (Mixed Content trên Vercel HTTPS).
 */
function configApiFetchUrl(backendPath: string): string {
  if (!backendPath.startsWith('/api/config')) {
    throw new Error(`configApiFetchUrl chỉ hỗ trợ /api/config/* (nhận: ${backendPath})`);
  }
  const tail = backendPath.replace(/^\/api\//, '');
  const proxyPath = `/api/remote/${tail}`;
  if (isBrowser()) {
    return proxyPath;
  }
  return `${getAppOriginForServerFetch()}${proxyPath}`;
}

export interface EventConfig {
  id: number;
  name: string;
  schedule: {
    type: 'hourly' | 'specific';
    interval?: number;
    startMinute?: number;
    times?: string[];
    duration: number;
  };
  color: string;
  /** Phần thưởng rơi (optional — backend có thể bổ sung sau) */
  drop?: string;
}

export interface DownloadLinks {
  mediafire: string;
  mega: string;
  clientVersion: string;
}

export interface SocialMedia {
  facebook?: string;
  youtube?: string;
  discord?: string;
  zalo?: string;
  tiktok?: string;
}

export interface BankTransfer {
  accountNumber: string;
  accountHolder: string;
  bankName: string;
  qrCodeUrl: string;
}

export interface StatsBoost {
  totalAccounts?: number;
  totalCharacters?: number;
  totalGuilds?: number;
  onlinePlayers?: number;
}

export interface ServerStats {
  totalAccounts: number;
  totalCharacters: number;
  totalGuilds: number;
  onlinePlayers: number;
}

export interface ServerInfo {
  name: string;
  version: string;
  standard?: string;
  expRate: string;
  dropRate: string;
}

export interface SiteConfig {
  nameGame?: string;
  gameTitle?: string;
  gameSubtitle?: string;
  serverName?: string;
  serverVersion?: string;
  phone?: string;
  email?: string;
  address?: string;
  websiteUrl?: string;
  websiteName?: string;
  linkFacebook?: string;
  linkDiscord?: string;
  linkYoutube?: string;
  linkZalo?: string;
  linkTikTok?: string;
  events: EventConfig[];
  downloadLinks: DownloadLinks;
  socialMedia: SocialMedia;
  bankTransfer: BankTransfer;
  serverInfo: ServerInfo;
  statsBoost?: StatsBoost;
}

/**
 * Lấy tất cả config từ backend (fallback im lặng qua proxy local)
 */
export async function getSiteConfig(): Promise<SiteConfig | null> {
  try {
    const url = configApiFetchUrl('/api/config');
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();

    if (result.success && result.data) {
      const data = result.data as SiteConfig;
      return {
        ...data,
        linkFacebook: data.linkFacebook ?? data.socialMedia?.facebook,
        linkDiscord: data.linkDiscord ?? data.socialMedia?.discord,
        linkYoutube: data.linkYoutube ?? data.socialMedia?.youtube,
        linkZalo: data.linkZalo ?? data.socialMedia?.zalo,
        linkTikTok: data.linkTikTok ?? data.socialMedia?.tiktok,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Thống kê server từ DB (tài khoản, nhân vật, guild, online)
 */
export async function getServerStats(): Promise<ServerStats | null> {
  try {
    const proxyPath = '/api/remote/stats';
    const url = isBrowser() ? proxyPath : `${getAppOriginForServerFetch()}${proxyPath}`;
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!response.ok) return null;
    const result = await response.json();
    if (result.success && result.data) {
      return {
        totalAccounts: Number(result.data.totalAccounts ?? 0),
        totalCharacters: Number(result.data.totalCharacters ?? 0),
        totalGuilds: Number(result.data.totalGuilds ?? 0),
        onlinePlayers: Number(result.data.onlinePlayers ?? result.data.onlineCount ?? 0),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Lấy config sự kiện
 */
export async function getEventsConfig(): Promise<EventConfig[]> {
  try {
    const response = await fetch(configApiFetchUrl('/api/config/events'), {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!response.ok) return [];
    const result = await response.json();
    if (result.success) return result.data;
    return [];
  } catch {
    return [];
  }
}

/**
 * Lấy config download links
 */
export async function getDownloadConfig(): Promise<DownloadLinks | null> {
  try {
    const response = await fetch(configApiFetchUrl('/api/config/download'), {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        return result.data;
      }
    }
    // Một số backend chỉ trả downloadLinks trong GET /api/config
    const site = await getSiteConfig();
    return site?.downloadLinks ?? null;
  } catch {
    try {
      const site = await getSiteConfig();
      return site?.downloadLinks ?? null;
    } catch {
      return null;
    }
  }
}

/**
 * Lấy config mạng xã hội
 */
export async function getSocialMediaConfig(): Promise<SocialMedia | null> {
  try {
    const response = await fetch(configApiFetchUrl('/api/config/social'), {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
    const result = await response.json();
    
    if (result.success) {
      return result.data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Lấy config chuyển khoản
 */
export async function getBankTransferConfig(): Promise<BankTransfer | null> {
  try {
    const response = await fetch(configApiFetchUrl('/api/config/bank'), {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
    const result = await response.json();
    
    if (result.success) {
      return result.data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Lấy config server info
 */
export async function getServerInfoConfig(): Promise<ServerInfo | null> {
  try {
    const response = await fetch(configApiFetchUrl('/api/config/server'), {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
    const result = await response.json();
    
    if (result.success) {
      return result.data;
    }
    return null;
  } catch {
    return null;
  }
}
