'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import siteConfigStatic from '@/config/site.config.json';
import { getSiteConfig, getEventsConfig, type SiteConfig, type EventConfig } from '@/lib/config-api';
import {
  mergeDisplayStats,
  statsFromBoostOnly,
  type StatsApiResponse,
  type ServerStats,
} from '@/lib/server-stats';
import ClassIcon from '@/components/ClassIcon';

interface PlayerRow {
  character: string;
  class: number;
  score?: number;
  level?: number | null;
}

/** Tên hiển thị gọn (bỏ ngoặc vuông) */
function eventDisplayName(name: string): string {
  return name.replace(/[[\]]/g, '').trim();
}

function scheduleMatches(ev: EventConfig, hour: number, minute: number): boolean {
  const s = ev.schedule;
  if (s.type === 'hourly') {
    const interval = s.interval || 2;
    const startMinute = s.startMinute || 0;
    if (minute !== startMinute) return false;
    return hour % interval === (startMinute === 0 ? 0 : 1);
  }
  if (s.type === 'specific') {
    return (s.times || []).some((t) => {
      const [h, m] = t.split(':').map(Number);
      return h === hour && m === minute;
    });
  }
  return false;
}

/** Tính số giây còn lại tới lần mở kế tiếp (hoặc thời gian còn lại nếu đang diễn ra) */
function computeEvent(ev: EventConfig, now: Date): { seconds: number; running: boolean } {
  const h = now.getHours();
  const m = now.getMinutes();
  const sec = now.getSeconds();
  const duration = ev.schedule.duration || 10;

  if (scheduleMatches(ev, h, m) && sec < duration * 60) {
    return { seconds: duration * 60 - sec, running: true };
  }

  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    const startHour = dayOffset === 0 ? h : 0;
    for (let hour = startHour; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute++) {
        if (!scheduleMatches(ev, hour, minute)) continue;
        const t = new Date(now);
        t.setDate(t.getDate() + dayOffset);
        t.setHours(hour, minute, 0, 0);
        const diff = Math.floor((t.getTime() - now.getTime()) / 1000);
        if (diff > 0) return { seconds: diff, running: false };
      }
    }
  }
  return { seconds: 0, running: false };
}

function formatCountdown(seconds: number): string {
  const hh = Math.floor(seconds / 3600);
  const mm = Math.floor((seconds % 3600) / 60);
  const ss = Math.floor(seconds % 60);
  return `${hh}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
}

export default function Sidebar() {
  const [config, setConfig] = useState<SiteConfig>(siteConfigStatic as unknown as SiteConfig);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [topPlayers, setTopPlayers] = useState<PlayerRow[]>([]);
  const [rankLoading, setRankLoading] = useState(true);
  const [statsApi, setStatsApi] = useState<StatsApiResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [events, setEvents] = useState<EventConfig[]>([]);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    getSiteConfig().then((c) => { if (c) setConfig({ ...siteConfigStatic, ...c } as SiteConfig); });
  }, []);

  useEffect(() => {
    getEventsConfig().then((evs) => { if (evs && evs.length > 0) setEvents(evs); });
  }, []);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetch('/api/rankings/level')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setTopPlayers(
            data.data.slice(0, 10).map((c: Record<string, unknown>) => ({
              character: String(c.character ?? c.Name ?? ''),
              class: Number(c.class ?? c.Class ?? 0),
              score: Number(c.score ?? c.Score ?? c.resets ?? 0),
              level: c.level != null ? Number(c.level) : c.cLevel != null ? Number(c.cLevel) : null,
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setRankLoading(false));
  }, []);

  useEffect(() => {
    const loadStats = () => {
      fetch('/api/stats', { cache: 'no-store' })
        .then((r) => r.json())
        .then((data: StatsApiResponse) => {
          if (data.success && data.data) {
            setStatsApi(data);
            setStatsError(false);
          } else {
            setStatsApi(null);
            setStatsError(true);
          }
        })
        .catch(() => {
          setStatsApi(null);
          setStatsError(true);
        })
        .finally(() => setStatsLoading(false));
    };

    loadStats();
    const id = setInterval(loadStats, 60_000);
    return () => clearInterval(id);
  }, []);

  const cfg = config;
  const boost = cfg?.statsBoost ?? (siteConfigStatic as { statsBoost?: SiteConfig['statsBoost'] }).statsBoost;
  const displayStats: ServerStats | null =
    mergeDisplayStats(statsApi, boost) ?? statsFromBoostOnly(boost);
  const serverName = cfg?.serverName || cfg?.nameGame || 'Mu Online';
  const phone = cfg?.phone || 'Hotline';
  const zaloLink = cfg?.linkZalo || cfg?.socialMedia?.zalo || '#';
  const expRate = cfg?.serverInfo?.expRate || 'x100';
  const dropRate = cfg?.serverInfo?.dropRate || '50%';
  const version = cfg?.serverInfo?.version || cfg?.serverVersion || 'Season 1';
  const standard = cfg?.serverInfo?.standard || 'Không hạ cấp';

  const formatStat = (value: number) => value.toLocaleString('vi-VN');
  const statCell = (value: number | undefined) => {
    if (statsLoading) return '…';
    if (value === undefined || !displayStats) return '—';
    return formatStat(value);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setLoginError('Vui lòng nhập tên đăng nhập và mật khẩu');
      return;
    }
    setLoggingIn(true);
    setLoginError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const result = await res.json();
      if (result.success) {
        if (result.data?.token) localStorage.setItem('auth_token', result.data.token);
        localStorage.setItem('user_data', JSON.stringify(result.data || {}));
        window.location.href = '/dashboard';
      } else {
        setLoginError(result.message || 'Đăng nhập thất bại');
      }
    } catch {
      setLoginError('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <aside className="we-sidebar-col">
      {/* Đăng nhập tài khoản */}
      <div className="we-box">
        <div className="we-box-head">
          Đăng nhập tài khoản
          <Link href="/login" className="we-box-head-link">Quên mật khẩu?</Link>
        </div>
        <div className="we-box-body">
          <form onSubmit={handleLogin}>
            <input
              type="text"
              className="we-input"
              placeholder="Tên đăng nhập"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
            <input
              type="password"
              className="we-input"
              placeholder="Mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {loginError && (
              <p style={{ color: '#cc0000', fontSize: 12, marginBottom: 8 }}>{loginError}</p>
            )}
            <button type="submit" className="we-btn we-btn-block" disabled={loggingIn}>
              {loggingIn ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>
        </div>
      </div>

      {/* Zalo Groups */}
      <div className="we-box">
        <div className="we-box-head">Nhóm Zalo</div>
        <div className="we-box-body" style={{ paddingTop: 4, paddingBottom: 4 }}>
          <a href={zaloLink} target="_blank" rel="noopener noreferrer" className="we-zalo-item">
            <Image src="/Zalo-icon.webp" alt="Zalo" width={28} height={28} className="we-zalo-icon" />
            THẢO LUẬN - {serverName.toUpperCase()}
          </a>
          <a href={zaloLink} target="_blank" rel="noopener noreferrer" className="we-zalo-item">
            <Image src="/Zalo-icon.webp" alt="Zalo" width={28} height={28} className="we-zalo-icon" />
            THÔNG BÁO - {serverName.toUpperCase()}
          </a>
        </div>
      </div>

      {/* Admin Support + banner đăng ký / tải game */}
      <div className="we-box">
        <div className="we-box-head">Hỗ Trợ Admin</div>
        <div className="we-box-body">
          <p style={{ fontWeight: 700, fontSize: 14, margin: '0 0 12px' }}>
            HOTLINE: {phone}
          </p>
          <Link href="/register" className="we-banner-link">
            <Image
              src="/DANG-KY.PNG"
              alt="Đăng ký tài khoản"
              width={343}
              height={125}
              unoptimized
            />
          </Link>
          <Link href="/download" className="we-banner-link">
            <Image
              src="/TAI-GAME.PNG"
              alt="Tải game"
              width={343}
              height={125}
              unoptimized
            />
          </Link>
        </div>
      </div>

      {/* Thông tin server */}
      <div className="we-box">
        <div className="we-box-head">Thông tin Server</div>
        <div className="we-box-body">
          <table className="we-info-table">
            <tbody>
              <tr>
                <td>Phiên bản</td>
                <td className="we-val-orange">{version}</td>
              </tr>
              <tr>
                <td>Chuẩn</td>
                <td>{standard}</td>
              </tr>
              <tr>
                <td>Kinh nghiệm</td>
                <td className="we-val-blue">{expRate}</td>
              </tr>
              <tr>
                <td>Tỷ lệ rơi đồ</td>
                <td>{dropRate}</td>
              </tr>
              <tr>
                <td>Tổng số Tài khoản</td>
                <td>{statCell(displayStats?.totalAccounts)}</td>
              </tr>
              <tr>
                <td>Tổng số Nhân vật</td>
                <td>{statCell(displayStats?.totalCharacters)}</td>
              </tr>
              <tr>
                <td>Tổng số Guilds</td>
                <td>{statCell(displayStats?.totalGuilds)}</td>
              </tr>
              <tr>
                <td>Số người Online</td>
                <td className="we-val-green">{statCell(displayStats?.onlinePlayers)}</td>
              </tr>
            </tbody>
          </table>
          {statsError && !statsLoading && !displayStats && (
            <p style={{ fontSize: 11, color: '#b45309', margin: '8px 0 0', textAlign: 'center' }}>
              Chưa lấy được số liệu — cần cập nhật backend (API /api/stats)
            </p>
          )}
        </div>
      </div>

      {/* Event Time */}
      {events.length > 0 && (
        <div className="we-box">
          <div className="we-box-head">Event Time</div>
          <div className="we-box-body">
            <table className="we-event-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => {
                  const state = now ? computeEvent(ev, now) : null;
                  const timeStr = !state
                    ? '--:--:--'
                    : state.running
                      ? 'Đang diễn ra'
                      : formatCountdown(state.seconds);
                  const soon = !!state && !state.running && state.seconds <= 300;
                  return (
                    <tr key={ev.id}>
                      <td>{eventDisplayName(ev.name)}</td>
                      <td
                        className={`we-event-time${state?.running ? ' is-running' : ''}${soon ? ' is-soon' : ''}`}
                      >
                        {timeStr}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Reset */}
      <div className="we-box">
        <div className="we-box-head">
          Top Reset
          <Link href="/rankings" style={{ fontSize: 18, color: '#cc0000', textDecoration: 'none' }}>+</Link>
        </div>
        <div className="we-box-body">
          {rankLoading ? (
            <div className="we-loading-center"><div className="we-spinner" /></div>
          ) : topPlayers.length === 0 ? (
            <p style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>Chưa có dữ liệu</p>
          ) : (
            <table className="we-mini-rank">
              <thead>
                <tr>
                  <th>Nhân vật</th>
                  <th style={{ textAlign: 'right' }}>Reset</th>
                </tr>
              </thead>
              <tbody>
                {topPlayers.map((p, i) => (
                  <tr key={`${p.character}-${i}`}>
                    <td>
                      <ClassIcon classId={p.class} size={22} className="we-class-icon--inline" />
                      {p.character}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{p.score ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </aside>
  );
}
