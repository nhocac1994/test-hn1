'use client';

import { useState, useEffect, useRef } from 'react';
import { RANKING_GUILD_FALLBACK } from '@/lib/ranking-fallback-data';
import type { RankingPagination } from '@/lib/ranking-api';
import RankingPaginationBar from '@/components/RankingPaginationBar';

function isSameGuildData(a: GuildRank[], b: GuildRank[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, i) => {
    const o = b[i];
    return o && item.guildName === o.guildName && (item.score ?? 0) === (o.score ?? 0) && (item.memberCount ?? 0) === (o.memberCount ?? 0);
  });
}

interface GuildRank {
  guildName: string;
  score: number;
  guildMaster: string;
  memberCount: number;
  guildMark?: string | null;
}

const SAMPLE_GUILDS: GuildRank[] = RANKING_GUILD_FALLBACK;

interface GuildRankingTableProps {
  title: string;
  endpoint: string;
  embedded?: boolean;
}

export default function GuildRankingTable({ title, endpoint, embedded }: GuildRankingTableProps) {
  const [guilds, setGuilds] = useState<GuildRank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'database' | 'fallback' | 'cache' | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<RankingPagination | null>(null);
  const [isAddingSample, setIsAddingSample] = useState(false);
  const lastDataRef = useRef<GuildRank[]>([]);
  const isMountedRef = useRef(true);
  const fetchIdRef = useRef(0);

  const fetchGuildRankings = async (requestId?: number, pageNum = 1) => {
    const activeRequestId = requestId ?? fetchIdRef.current;
    try {
      const isInitial = lastDataRef.current.length === 0;
      if (isInitial) setLoading(true);

      const response = await fetch(`/api/rankings/${endpoint}?page=${pageNum}`);
      const data = await response.json();

      if (!isMountedRef.current || activeRequestId !== fetchIdRef.current) return;

      if (data.success && Array.isArray(data.data)) {
        const metaSource = data.meta?.source as string | undefined;
        if (metaSource === 'database') setDataSource('database');
        else if (data.message?.includes('cache')) setDataSource('cache');
        else if (metaSource === 'fallback') setDataSource('fallback');

        setPagination(data.pagination ?? data.meta?.pagination ?? null);
        setPage(pageNum);

        const newData = data.data;
        if (!isSameGuildData(lastDataRef.current, newData)) {
          lastDataRef.current = newData;
          setGuilds(newData);
        }
        setError(null);
      } else {
        setError(null);
        if (lastDataRef.current.length === 0) {
          lastDataRef.current = SAMPLE_GUILDS;
          setGuilds(SAMPLE_GUILDS);
          setDataSource('fallback');
        }
      }
    } catch (err) {
      if (!isMountedRef.current || activeRequestId !== fetchIdRef.current) return;
      setError(null);
      if (lastDataRef.current.length === 0) {
        lastDataRef.current = SAMPLE_GUILDS;
        setGuilds(SAMPLE_GUILDS);
        setDataSource('fallback');
      }
    } finally {
      if (isMountedRef.current && activeRequestId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  };

  const addSampleGuilds = async () => {
    try {
      setIsAddingSample(true);
      const response = await fetch('/api/guilds/sample', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        alert(data.message);
        // Reload data after adding samples
        await fetchGuildRankings();
      } else {
        alert('Lỗi: ' + data.message);
      }
    } catch (err) {
      alert('Lỗi khi thêm dữ liệu mẫu');
    } finally {
      setIsAddingSample(false);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    const requestId = ++fetchIdRef.current;
    lastDataRef.current = [];
    setGuilds([]);
    setDataSource(null);
    setPage(1);
    setPagination(null);
    setLoading(true);
    fetchGuildRankings(requestId, 1);
    return () => { isMountedRef.current = false; };
  }, [endpoint]);

  const handlePageChange = (nextPage: number) => {
    const requestId = ++fetchIdRef.current;
    setLoading(true);
    fetchGuildRankings(requestId, nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const rankOffset = pagination ? (pagination.page - 1) * pagination.limit : 0;

  const getRankIcon = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  const getGuildLogo = (guild: GuildRank) => {
    if (guild.guildMark) {
      return (
        <img
          src={guild.guildMark}
          alt={`Logo ${guild.guildName}`}
          width={32}
          height={32}
          className="h-6 w-6 rounded border border-purple-500/25 bg-black/40 sm:h-8 sm:w-8"
          style={{ imageRendering: 'pixelated' }}
        />
      );
    }

    if (!guild.guildName) return null;

    const firstLetter = guild.guildName.charAt(0).toUpperCase();
    const colors = [
      'bg-violet-600', 'bg-purple-600', 'bg-fuchsia-700',
      'bg-indigo-600', 'bg-violet-700', 'bg-purple-700',
      'bg-fuchsia-600', 'bg-indigo-700', 'bg-violet-800', 'bg-purple-800',
    ];
    const colorIndex = guild.guildName.length % colors.length;

    return (
      <div className={`flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-white shadow-lg sm:h-8 sm:w-8 sm:text-sm ${colors[colorIndex]}`}>
        {firstLetter}
      </div>
    );
  };

  const formatValue = (value: number | string) => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    return value.toString();
  };

  if (loading) {
    return (
      <div className="we-loading-center"><div className="we-spinner" /></div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      {dataSource === 'fallback' && (
        <p style={{ fontSize: 12, color: '#b45309', margin: '0 0 10px', textAlign: 'center' }}>
          Đang hiển thị dữ liệu mẫu — backend tạm thời không phản hồi.
        </p>
      )}
      {dataSource === 'cache' && (
        <p style={{ fontSize: 12, color: '#b45309', margin: '0 0 10px', textAlign: 'center' }}>
          Đang hiển thị dữ liệu cache — backend tạm thời quá tải.
        </p>
      )}
      <table className="we-rank-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Logo</th>
            <th>Guild</th>
            <th>Master</th>
            <th>Members</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {guilds.map((guild, index) => (
            <tr key={guild.guildName}>
              <td>{rankOffset + index + 1}</td>
              <td>{getGuildLogo(guild)}</td>
              <td className="char-name">{guild.guildName || '—'}</td>
              <td>{guild.guildMaster || '—'}</td>
              <td>{formatValue(guild.memberCount)}</td>
              <td style={{ fontWeight: 700 }}>{formatValue(guild.score)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {guilds.length === 0 && (
        <p style={{ textAlign: 'center', padding: 20, color: '#999', fontSize: 13 }}>
          Chưa có dữ liệu guild
        </p>
      )}

      <RankingPaginationBar
        pagination={pagination}
        onPageChange={handlePageChange}
        loading={loading}
      />
    </div>
  );
}
