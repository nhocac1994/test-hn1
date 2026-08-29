export interface EventFormItem {
  id: number;
  name: string;
  color: string;
  scheduleType: 'hourly' | 'specific';
  interval: number;
  startMinute: number;
  duration: number;
  times: string;
}

export interface ConfigFormState {
  nameGame: string;
  gameTitle: string;
  gameSubtitle: string;
  serverName: string;
  serverVersion: string;
  phone: string;
  email: string;
  address: string;
  websiteUrl: string;
  websiteName: string;
  expRate: string;
  dropRate: string;
  standard: string;
  mediafire: string;
  mega: string;
  clientVersion: string;
  facebook: string;
  youtube: string;
  discord: string;
  zalo: string;
  tiktok: string;
  accountNumber: string;
  accountHolder: string;
  bankName: string;
  qrCodeUrl: string;
  events: EventFormItem[];
  boostAccounts: string;
  boostCharacters: string;
  boostGuilds: string;
  boostOnline: string;
}

export const emptyConfigForm = (): ConfigFormState => ({
  nameGame: '',
  gameTitle: 'Mu Online Season 1',
  gameSubtitle: '',
  serverName: '',
  serverVersion: 'Season 1',
  phone: '',
  email: '',
  address: 'Việt Nam',
  websiteUrl: '',
  websiteName: '',
  expRate: 'x100',
  dropRate: 'x50',
  standard: 'Không hạ cấp',
  mediafire: '',
  mega: '',
  clientVersion: 'V1.1',
  facebook: '',
  youtube: '',
  discord: '',
  zalo: '',
  tiktok: '',
  accountNumber: '',
  accountHolder: '',
  bankName: '',
  qrCodeUrl: '',
  events: [],
  boostAccounts: '0',
  boostCharacters: '0',
  boostGuilds: '0',
  boostOnline: '0',
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function configToFormState(raw: Record<string, any>): ConfigFormState {
  const sm = raw.socialMedia ?? {};
  const dl = raw.downloadLinks ?? {};
  const bank = raw.bankTransfer ?? {};
  const si = raw.serverInfo ?? {};
  const boost = raw.statsBoost ?? {};
  const events: EventFormItem[] = (raw.events ?? []).map((e: Record<string, unknown>) => {
    const sch = (e.schedule ?? {}) as Record<string, unknown>;
    const type = sch.type === 'specific' ? 'specific' : 'hourly';
    const timesArr = Array.isArray(sch.times) ? (sch.times as string[]) : [];
    return {
      id: Number(e.id ?? 0),
      name: String(e.name ?? ''),
      color: String(e.color ?? '#9333ea'),
      scheduleType: type,
      interval: Number(sch.interval ?? 2),
      startMinute: Number(sch.startMinute ?? 0),
      duration: Number(sch.duration ?? 10),
      times: timesArr.join(', '),
    };
  });

  return {
    nameGame: String(raw.nameGame ?? ''),
    gameTitle: String(raw.gameTitle ?? 'Mu Online Season 1'),
    gameSubtitle: String(raw.gameSubtitle ?? ''),
    serverName: String(raw.serverName ?? raw.nameGame ?? ''),
    serverVersion: String(raw.serverVersion ?? 'Season 1'),
    phone: String(raw.phone ?? ''),
    email: String(raw.email ?? ''),
    address: String(raw.address ?? ''),
    websiteUrl: String(raw.websiteUrl ?? ''),
    websiteName: String(raw.websiteName ?? ''),
    expRate: String(si.expRate ?? raw.expRate ?? 'x100'),
    dropRate: String(si.dropRate ?? raw.dropRate ?? 'x50'),
    standard: String(si.standard ?? raw.standard ?? 'Không hạ cấp'),
    boostAccounts: String(boost.totalAccounts ?? 0),
    boostCharacters: String(boost.totalCharacters ?? 0),
    boostGuilds: String(boost.totalGuilds ?? 0),
    boostOnline: String(boost.onlinePlayers ?? 0),
    mediafire: String(dl.mediafire ?? ''),
    mega: String(dl.mega ?? ''),
    clientVersion: String(dl.clientVersion ?? 'V1.1'),
    facebook: String(sm.facebook ?? raw.linkFacebook ?? ''),
    youtube: String(sm.youtube ?? raw.linkYoutube ?? ''),
    discord: String(sm.discord ?? raw.linkDiscord ?? ''),
    zalo: String(sm.zalo ?? raw.linkZalo ?? ''),
    tiktok: String(sm.tiktok ?? raw.linkTikTok ?? ''),
    accountNumber: String(bank.accountNumber ?? ''),
    accountHolder: String(bank.accountHolder ?? ''),
    bankName: String(bank.bankName ?? ''),
    qrCodeUrl: String(bank.qrCodeUrl ?? ''),
    events,
  };
}

export function formStateToConfig(form: ConfigFormState): Record<string, unknown> {
  const serverName = form.serverName || form.nameGame;
  return {
    nameGame: form.nameGame,
    gameTitle: form.gameTitle,
    gameSubtitle: form.gameSubtitle,
    serverName,
    serverVersion: form.serverVersion,
    phone: form.phone,
    email: form.email,
    address: form.address,
    websiteUrl: form.websiteUrl,
    websiteName: form.websiteName || serverName,
    events: form.events.map((e) => {
      const schedule =
        e.scheduleType === 'specific'
          ? {
              type: 'specific',
              times: e.times
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
              duration: e.duration,
            }
          : {
              type: 'hourly',
              interval: e.interval,
              startMinute: e.startMinute,
              duration: e.duration,
            };
      return { id: e.id, name: e.name, schedule, color: e.color };
    }),
    downloadLinks: {
      mediafire: form.mediafire,
      mega: form.mega,
      clientVersion: form.clientVersion,
    },
    socialMedia: {
      facebook: form.facebook,
      youtube: form.youtube,
      discord: form.discord,
      zalo: form.zalo,
      tiktok: form.tiktok,
    },
    linkFacebook: form.facebook,
    linkYoutube: form.youtube,
    linkDiscord: form.discord,
    linkZalo: form.zalo,
    linkTikTok: form.tiktok,
    bankTransfer: {
      accountNumber: form.accountNumber,
      accountHolder: form.accountHolder,
      bankName: form.bankName,
      qrCodeUrl: form.qrCodeUrl,
    },
    serverInfo: {
      name: serverName,
      version: form.serverVersion,
      standard: form.standard,
      expRate: form.expRate,
      dropRate: form.dropRate,
    },
    statsBoost: {
      totalAccounts: Number(form.boostAccounts) || 0,
      totalCharacters: Number(form.boostCharacters) || 0,
      totalGuilds: Number(form.boostGuilds) || 0,
      onlinePlayers: Number(form.boostOnline) || 0,
    },
  };
}

export function newEventItem(): EventFormItem {
  return {
    id: Date.now() % 100000,
    name: 'Sự kiện mới',
    color: '#9333ea',
    scheduleType: 'hourly',
    interval: 2,
    startMinute: 0,
    duration: 10,
    times: '12:00, 20:00',
  };
}
