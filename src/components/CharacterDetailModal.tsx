'use client';

import React, { useEffect } from 'react';
import ClassIcon from '@/components/ClassIcon';

export type CharacterProfile = {
  name: string;
  class: number;
  className: string;
  level: number;
  reset: number;
  points: number | null;
  str: number;
  agi: number;
  vit: number;
  ene: number;
  cmd: number;
  isOnline: boolean;
};

type CharacterDetailModalProps = {
  open: boolean;
  loading: boolean;
  error: string | null;
  profile: CharacterProfile | null;
  onClose: () => void;
};

function formatStat(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toLocaleString('vi-VN');
}

export default function CharacterDetailModal({
  open,
  loading,
  error,
  profile,
  onClose,
}: CharacterDetailModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="we-dash-modal-backdrop" onClick={onClose}>
      <div
        className="we-dash-modal we-char-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="char-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="char-detail-title">Thông tin nhân vật</h3>

        {loading && (
          <div className="we-loading-center" style={{ padding: '24px 0' }}>
            <div className="we-spinner" />
          </div>
        )}

        {!loading && error && (
          <p className="we-char-detail-error">{error}</p>
        )}

        {!loading && profile && (
          <>
            <div className="we-char-detail-header">
              <ClassIcon classId={profile.class} size={40} />
              <div>
                <p className="we-char-detail-name">{profile.name}</p>
                <p className="we-char-detail-class">{profile.className}</p>
              </div>
              <span
                className={`we-char-detail-status ${profile.isOnline ? 'we-char-detail-status--online' : 'we-char-detail-status--offline'}`}
              >
                {profile.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            <div className="we-char-detail-grid">
              <div className="we-char-detail-stat">
                <span>Reset</span>
                <strong>{formatStat(profile.reset)}</strong>
              </div>
              <div className="we-char-detail-stat">
                <span>Level</span>
                <strong>{formatStat(profile.level)}</strong>
              </div>
              <div className="we-char-detail-stat">
                <span>Point</span>
                <strong>{formatStat(profile.points)}</strong>
              </div>
              <div className="we-char-detail-stat">
                <span>Str</span>
                <strong>{formatStat(profile.str)}</strong>
              </div>
              <div className="we-char-detail-stat">
                <span>Agi</span>
                <strong>{formatStat(profile.agi)}</strong>
              </div>
              <div className="we-char-detail-stat">
                <span>Vit</span>
                <strong>{formatStat(profile.vit)}</strong>
              </div>
              <div className="we-char-detail-stat">
                <span>Ene</span>
                <strong>{formatStat(profile.ene)}</strong>
              </div>
              <div className="we-char-detail-stat">
                <span>Cmd</span>
                <strong>{formatStat(profile.cmd)}</strong>
              </div>
              <div className="we-char-detail-stat we-char-detail-stat--wide">
                <span>Status</span>
                <strong>{profile.isOnline ? 'Online' : 'Offline'}</strong>
              </div>
            </div>
          </>
        )}

        <button type="button" onClick={onClose} className="we-btn we-btn-block" style={{ marginTop: 14 }}>
          Đóng
        </button>
      </div>
    </div>
  );
}
