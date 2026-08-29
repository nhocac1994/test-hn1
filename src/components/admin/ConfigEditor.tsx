'use client';

import React from 'react';
import {
  type ConfigFormState,
  type EventFormItem,
  newEventItem,
} from '@/lib/admin-config';

const fieldClass =
  'w-full rounded-lg border border-purple-500/20 bg-black/60 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-purple-400 focus:outline-none';
const labelClass = 'mb-1 block text-xs font-medium text-zinc-400';
const sectionClass = 'rounded-xl border border-purple-500/20 bg-[#120818]/60 p-4 space-y-3';

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type={type}
        className={fieldClass}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function EventCard({
  event,
  onChange,
  onRemove,
}: {
  event: EventFormItem;
  onChange: (e: EventFormItem) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-purple-500/15 bg-black/40 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-purple-300">Sự kiện #{event.id}</span>
        <button type="button" onClick={onRemove} className="text-xs text-red-400 hover:text-red-300">
          Xóa
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Tên sự kiện</label>
          <input className={fieldClass} value={event.name} onChange={(e) => onChange({ ...event, name: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Màu hiển thị</label>
          <input type="color" className="h-10 w-full cursor-pointer rounded border border-purple-500/20 bg-black" value={event.color} onChange={(e) => onChange({ ...event, color: e.target.value })} />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Kiểu lịch</label>
          <select
            className={fieldClass}
            value={event.scheduleType}
            onChange={(e) => onChange({ ...event, scheduleType: e.target.value as 'hourly' | 'specific' })}
          >
            <option value="hourly">Lặp theo giờ</option>
            <option value="specific">Giờ cố định</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Thời lượng (phút)</label>
          <input type="number" className={fieldClass} value={event.duration} onChange={(e) => onChange({ ...event, duration: Number(e.target.value) })} />
        </div>
      </div>
      {event.scheduleType === 'hourly' ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Mỗi X giờ</label>
            <input type="number" className={fieldClass} value={event.interval} onChange={(e) => onChange({ ...event, interval: Number(e.target.value) })} />
          </div>
          <div>
            <label className={labelClass}>Phút bắt đầu (0–59)</label>
            <input type="number" className={fieldClass} value={event.startMinute} onChange={(e) => onChange({ ...event, startMinute: Number(e.target.value) })} />
          </div>
        </div>
      ) : (
        <div>
          <label className={labelClass}>Giờ cố định (cách nhau bằng dấu phẩy, VD: 12:30, 20:15)</label>
          <input className={fieldClass} value={event.times} onChange={(e) => onChange({ ...event, times: e.target.value })} />
        </div>
      )}
    </div>
  );
}

export default function ConfigEditor({
  form,
  onChange,
}: {
  form: ConfigFormState;
  onChange: (f: ConfigFormState) => void;
}) {
  const set = <K extends keyof ConfigFormState>(key: K, value: ConfigFormState[K]) =>
    onChange({ ...form, [key]: value });

  return (
    <div className="space-y-4">
      <section className={sectionClass}>
        <h3 className="text-sm font-bold text-purple-300">Thông tin server</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tên game / website" value={form.nameGame} onChange={(v) => set('nameGame', v)} />
          <Field label="Tên hiển thị server" value={form.serverName} onChange={(v) => set('serverName', v)} />
          <Field label="Tiêu đề game" value={form.gameTitle} onChange={(v) => set('gameTitle', v)} />
          <Field label="Phiên bản" value={form.serverVersion} onChange={(v) => set('serverVersion', v)} />
          <Field label="Chuẩn" value={form.standard} onChange={(v) => set('standard', v)} placeholder="Không hạ cấp" />
          <Field label="Slogan / mô tả ngắn" value={form.gameSubtitle} onChange={(v) => set('gameSubtitle', v)} />
          <Field label="Tỷ lệ EXP" value={form.expRate} onChange={(v) => set('expRate', v)} placeholder="x100" />
          <Field label="Tỷ lệ Drop" value={form.dropRate} onChange={(v) => set('dropRate', v)} placeholder="x50" />
        </div>
      </section>

      <section className={sectionClass}>
        <h3 className="text-sm font-bold text-purple-300">Tỷ lệ hiển thị thống kê (statsBoost)</h3>
        <p className="text-xs text-zinc-400">Số cộng thêm vào thống kê thật từ DB khi hiển thị web.</p>
        <p className="text-xs text-gray-400 mb-3">
          Cộng thêm vào số liệu DB khi hiển thị Sidebar (cả 4 chỉ số).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cộng thêm Tài khoản" value={form.boostAccounts} onChange={(v) => set('boostAccounts', v)} />
          <Field label="Cộng thêm Nhân vật" value={form.boostCharacters} onChange={(v) => set('boostCharacters', v)} />
          <Field label="Cộng thêm Guilds" value={form.boostGuilds} onChange={(v) => set('boostGuilds', v)} />
          <Field label="Cộng thêm Online" value={form.boostOnline} onChange={(v) => set('boostOnline', v)} />
        </div>
      </section>

      <section className={sectionClass}>
        <h3 className="text-sm font-bold text-purple-300">Liên hệ</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Số điện thoại" value={form.phone} onChange={(v) => set('phone', v)} />
          <Field label="Email" value={form.email} onChange={(v) => set('email', v)} />
          <Field label="Địa chỉ" value={form.address} onChange={(v) => set('address', v)} />
          <Field label="URL website" value={form.websiteUrl} onChange={(v) => set('websiteUrl', v)} />
        </div>
      </section>

      <section className={sectionClass}>
        <h3 className="text-sm font-bold text-purple-300">Link tải game</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="MediaFire" value={form.mediafire} onChange={(v) => set('mediafire', v)} />
          <Field label="MEGA" value={form.mega} onChange={(v) => set('mega', v)} />
          <Field label="Phiên bản client" value={form.clientVersion} onChange={(v) => set('clientVersion', v)} />
        </div>
      </section>

      <section className={sectionClass}>
        <h3 className="text-sm font-bold text-purple-300">Mạng xã hội</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Facebook" value={form.facebook} onChange={(v) => set('facebook', v)} />
          <Field label="YouTube" value={form.youtube} onChange={(v) => set('youtube', v)} />
          <Field label="Discord" value={form.discord} onChange={(v) => set('discord', v)} />
          <Field label="Zalo" value={form.zalo} onChange={(v) => set('zalo', v)} />
          <Field label="TikTok" value={form.tiktok} onChange={(v) => set('tiktok', v)} />
        </div>
      </section>

      <section className={sectionClass}>
        <h3 className="text-sm font-bold text-purple-300">Chuyển khoản / Donate</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Số tài khoản" value={form.accountNumber} onChange={(v) => set('accountNumber', v)} />
          <Field label="Chủ tài khoản" value={form.accountHolder} onChange={(v) => set('accountHolder', v)} />
          <Field label="Ngân hàng" value={form.bankName} onChange={(v) => set('bankName', v)} />
          <Field label="Link ảnh QR" value={form.qrCodeUrl} onChange={(v) => set('qrCodeUrl', v)} />
        </div>
      </section>

      <section className={sectionClass}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-purple-300">Sự kiện in-game</h3>
          <button
            type="button"
            className="text-xs text-purple-300 hover:text-purple-200"
            onClick={() => set('events', [...form.events, newEventItem()])}
          >
            + Thêm sự kiện
          </button>
        </div>
        <div className="space-y-3">
          {form.events.length === 0 && (
            <p className="text-xs text-zinc-500">Chưa có sự kiện — bấm &quot;Thêm sự kiện&quot;.</p>
          )}
          {form.events.map((ev, i) => (
            <EventCard
              key={`${ev.id}-${i}`}
              event={ev}
              onChange={(updated) => {
                const next = [...form.events];
                next[i] = updated;
                set('events', next);
              }}
              onRemove={() => set('events', form.events.filter((_, j) => j !== i))}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
