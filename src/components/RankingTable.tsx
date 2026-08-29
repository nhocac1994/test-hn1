'use client';

import { useState, useEffect, useRef } from 'react';
import { RANKING_LEVEL_FALLBACK } from '@/lib/ranking-fallback-data';
import type { CharacterRankingRow, RankingPagination } from '@/lib/ranking-api';
import ClassIcon from '@/components/ClassIcon';
import CharacterDetailModal, { type CharacterProfile } from '@/components/CharacterDetailModal';
import RankingPaginationBar from '@/components/RankingPaginationBar';

interface RankingTableProps {
  title: string;
  endpoint: string;
  scoreLabel?: string;
  enableSearch?: boolean;
  embedded?: boolean;
}

const SAMPLE_CHARACTERS: CharacterRankingRow[] = RANKING_LEVEL_FALLBACK.map((c) => ({
  account: c.account,
  character: c.character,
  class: c.class,
  score: c.resets,
  level: c.level,
  isOnline: c.isOnline,
}));

export default function RankingTable({
  endpoint,
  scoreLabel = 'Resets',
  enableSearch = false,
}: RankingTableProps) {
  const [characters, setCharacters] = useState<CharacterRankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [dataSource, setDataSource] = useState<'database' | 'fallback' | 'cache' | null>(null);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailProfile, setDetailProfile] = useState<CharacterProfile | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<RankingPagination | null>(null);
  const isMountedRef = useRef(true);
  const fetchIdRef = useRef(0);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailLoading(false);
    setDetailError(null);
    setDetailProfile(null);
  };

  const openCharacterDetail = async (char: CharacterRankingRow) => {
    if (!char.account || !char.character) {
      setDetailError('Không đủ thông tin để xem chi tiết nhân vật.');
      setDetailOpen(true);
      return;
    }

    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetailProfile(null);

    const isOnline = char.isOnline === 1 || char.isOnline === true;

    try {
      const params = new URLSearchParams({
        accountId: char.account,
        name: char.character,
      });
      const response = await fetch(`/api/characters/profile?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok || !data.success || !data.data) {
        setDetailError(data.message || 'Không lấy được thông tin nhân vật.');
        return;
      }

      setDetailProfile({
        ...data.data,
        isOnline,
      });
    } catch {
      setDetailError('Lỗi kết nối. Vui lòng thử lại sau.');
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchRankings = async (searchName?: string, requestId?: number, pageNum = 1) => {
    const activeRequestId = requestId ?? fetchIdRef.current;
    try {
      setLoading(true);
      setIsSearching(!!searchName);

      const url = searchName
        ? `/api/characters/search?name=${encodeURIComponent(searchName)}`
        : `/api/rankings/${endpoint}?page=${pageNum}`;

      const response = await fetch(url, { cache: 'no-store' });
      const data = await response.json();

      if (!isMountedRef.current || activeRequestId !== fetchIdRef.current) return;

      if (data.success && Array.isArray(data.data)) {
        const metaSource = data.meta?.source as string | undefined;
        if (metaSource === 'database') {
          setDataSource('database');
        } else if (metaSource === 'fallback') {
          setDataSource('fallback');
        } else if (data.message?.includes('cache')) {
          setDataSource('cache');
        }

        const newData: CharacterRankingRow[] = data.data.map((char: Record<string, unknown>) => ({
          account: String(char.account ?? char.AccountID ?? ''),
          character: String(char.character ?? char.Name ?? ''),
          class: Number(char.class ?? char.Class ?? 0),
          score: Number(char.score ?? char.Score ?? char.resets ?? char.ResetCount ?? 0),
          level: char.level != null ? Number(char.level) : char.cLevel != null ? Number(char.cLevel) : null,
          isOnline: (char.isOnline ?? char.IsOnline ?? 0) as number | boolean,
        }));

        // Luôn ghi đè list theo trang — không so sánh “giống dữ liệu cũ” (gây kẹt trang 1).
        setCharacters(newData);

        if (!searchName) {
          const apiPag = (data.pagination ?? data.meta?.pagination) as RankingPagination | null;
          setPagination(
            apiPag
              ? { ...apiPag, page: pageNum }
              : { page: pageNum, limit: 50, total: newData.length, totalPages: 1 }
          );
          setPage(pageNum);
        } else {
          setPagination(null);
        }

        setIsSearchMode(!!searchName);
        setSearchMessage(searchName ? (data.message || null) : null);
      } else if (!searchName && pageNum === 1) {
        setCharacters(SAMPLE_CHARACTERS);
        setSearchMessage(null);
      } else if (searchName) {
        setCharacters([]);
        setPagination(null);
        setIsSearchMode(true);
        setSearchMessage(data.message || `Không tìm thấy nhân vật "${searchName}"`);
      }
    } catch {
      if (!isMountedRef.current || activeRequestId !== fetchIdRef.current) return;
      if (!searchName && pageNum === 1) {
        setCharacters(SAMPLE_CHARACTERS);
      } else if (searchName) {
        setCharacters([]);
      }
    } finally {
      if (isMountedRef.current && activeRequestId === fetchIdRef.current) {
        setLoading(false);
        setIsSearching(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    const requestId = ++fetchIdRef.current;
    setSearchTerm('');
    setIsSearchMode(false);
    setDataSource(null);
    setSearchMessage(null);
    setPage(1);
    setPagination(null);
    setCharacters([]);
    setLoading(true);
    fetchRankings(undefined, requestId, 1);
    return () => {
      isMountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ reload khi đổi tab ranking
  }, [endpoint]);

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage === page) return;
    const requestId = ++fetchIdRef.current;
    setPage(nextPage);
    fetchRankings(undefined, requestId, nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const rankOffset = (page - 1) * (pagination?.limit ?? 50);

  return (
    <div>
      {enableSearch && isClient && (
        <div className="we-rank-search-row">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchRankings(searchTerm.trim() || undefined)}
            placeholder="Tìm nhân vật trên toàn server — Enter để tìm"
            className="we-rank-search"
          />
          <button
            type="button"
            className="we-btn we-rank-search-btn"
            onClick={() => fetchRankings(searchTerm.trim() || undefined)}
            disabled={!searchTerm.trim() || isSearching}
          >
            {isSearching ? 'Đang tìm…' : 'Tìm'}
          </button>
          {isSearchMode && (
            <button
              type="button"
              className="we-btn we-rank-search-clear"
              onClick={() => {
                setSearchTerm('');
                setPage(1);
                fetchRankings(undefined, undefined, 1);
              }}
            >
              Bảng xếp hạng
            </button>
          )}
        </div>
      )}

      {isSearchMode && !loading && (
        <p style={{ fontSize: 12, color: '#666', margin: '0 0 10px', textAlign: 'center' }}>
          {searchMessage ||
            'Kết quả tìm kiếm toàn server — tìm được mọi nhân vật trong database.'}
        </p>
      )}

      {dataSource === 'fallback' && (
        <p style={{ fontSize: 12, color: '#b45309', margin: '0 0 10px', textAlign: 'center' }}>
          Đang hiển thị dữ liệu mẫu — backend tạm thời không phản hồi (thường do HTTP 429). Thử tải lại sau vài giây.
        </p>
      )}

      {dataSource === 'cache' && (
        <p style={{ fontSize: 12, color: '#b45309', margin: '0 0 10px', textAlign: 'center' }}>
          Đang hiển thị dữ liệu cache — backend tạm thời quá tải. Dữ liệu có thể chậm vài phút so với game.
        </p>
      )}

      {loading ? (
        <div className="we-loading-center"><div className="we-spinner" /></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="we-rank-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Country</th>
                <th>Class</th>
                <th>Character</th>
                <th>Level</th>
                <th>{scoreLabel}</th>
              </tr>
            </thead>
            <tbody>
              {characters.map((char, index) => (
                <tr key={`${char.account}-${char.character}`}>
                  <td>{rankOffset + index + 1}</td>
                  <td>🇻🇳</td>
                  <td>
                    <ClassIcon classId={char.class} />
                  </td>
                  <td className="char-name">
                    <button
                      type="button"
                      className="we-char-name-btn"
                      onClick={() => openCharacterDetail(char)}
                      title={`Xem thông tin ${char.character}`}
                    >
                      {char.character}
                      <span
                        className={`we-status-dot ${char.isOnline === 1 || char.isOnline === true ? 'we-status-online' : 'we-status-offline'}`}
                      />
                    </button>
                  </td>
                  <td>{char.level ?? '—'}</td>
                  <td style={{ fontWeight: 700 }}>{char.score.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {characters.length === 0 && (
            <p style={{ textAlign: 'center', padding: 20, color: '#999', fontSize: 13 }}>
              {isSearchMode
                ? `Không tìm thấy nhân vật "${searchTerm}"`
                : dataSource === 'database'
                  ? 'Chưa có người chơi trong bảng xếp hạng này (database trống).'
                  : 'Chưa có dữ liệu xếp hạng — thử tải lại trang sau vài giây.'}
            </p>
          )}
          {!isSearchMode && (
            <RankingPaginationBar
              pagination={pagination ? { ...pagination, page } : null}
              onPageChange={handlePageChange}
              loading={loading}
            />
          )}
        </div>
      )}

      <CharacterDetailModal
        open={detailOpen}
        loading={detailLoading}
        error={detailError}
        profile={detailProfile}
        onClose={closeDetail}
      />
    </div>
  );
}
