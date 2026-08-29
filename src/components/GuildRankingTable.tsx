'use client';

import { useState, useEffect, useRef } from 'react';
import { RANKING_GUILD_FALLBACK } from '@/lib/ranking-fallback-data';
import type { RankingPagination } from '@/lib/ranking-api';
import RankingPaginationBar from '@/components/RankingPaginationBar';

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
  const isMountedRef = useRef(true);
  const fetchIdRef = useRef(0);

  const fetchGuildRankings = async (requestId?: number, pageNum = 1) => {
    const activeRequestId = requestId ?? fetchIdRef.current;
    try {
      setLoading(true);

      const response = await fetch(`/api/rankings/${endpoint}?page=${pageNum}`, { cache: 'no-store' });
      const data = await response.json();

      if (!isMountedRef.current || activeRequestId !== fetchIdRef.current) return;

      if (data.success && Array.isArray(data.data)) {
        const metaSource = data.meta?.source as string | undefined;
        if (metaSource === 'database') setDataSource('database');
        else if (data.message?.includes('cache')) setDataSource('cache');
        else if (metaSource === 'fallback') setDataSource('fallback');

        const newData = data.data as GuildRank[];
        setGuilds(newData);

        const apiPag = (data.pagination ?? data.meta?.pagination) as RankingPagination | null;
        setPagination(
          apiPag
            ? { ...apiPag, page: pageNum }
            : { page: pageNum, limit: 50, total: newData.length, totalPages: 1 }
        );
        setPage(pageNum);
        setError(null);
      } else if (pageNum === 1) {
        setError(null);
        setGuilds(SAMPLE_GUILDS);
        setDataSource('fallback');
      }
    } catch {
      if (!isMountedRef.current || activeRequestId !== fetchIdRef.current) return;
      setError(null);
      if (pageNum === 1) {
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
        await fetchGuildRankings();
      } else {
        alert('Lỗi: ' + data.message);
      }
    } catch {
      alert('Lỗi khi thêm dữ liệu mẫu');
    } finally {
      setIsAddingSample(false);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    const requestId = ++fetchIdRef.current;
    setGuilds([]);
    setDataSource(null);
    setPage(1);
    setPagination(null);
    setLoading(true);
    fetchGuildRankings(requestId, 1);
    return () => { isMountedRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage === page) return;
    const requestId = ++fetchIdRef.current;
    setPage(nextPage);
    fetchGuildRankings(requestId, nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const rankOffset = (page - 1) * (pagination?.limit ?? 50);

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
        pagination={pagination ? { ...pagination, page } : null}
        onPageChange={handlePageChange}
        loading={loading}
      />
    </div>
  );
}
