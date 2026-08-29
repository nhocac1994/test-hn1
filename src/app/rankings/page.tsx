'use client';

import React, { useState } from 'react';
import SubPageLayout from '@/components/SubPageLayout';
import Footer from '@/components/Footer';
import RankingTable from '@/components/RankingTable';
import GuildRankingTable from '@/components/GuildRankingTable';
import { RANKING_TAB_ROWS, getRankingTab, type RankingTabId } from '@/lib/rankings-config';

export default function RankingsPage() {
  const [activeTab, setActiveTab] = useState<RankingTabId>('level');
  const current = getRankingTab(activeTab)!;
  const allTabs = RANKING_TAB_ROWS.flat();

  return (
    <div className="we-page">
      <SubPageLayout breadcrumbs={[{ label: 'Xếp Hạng' }]} title="TOP Rankings" showSidebar={false}>
        <div className="we-box">
          <div className="we-box-body">
            <div className="we-rank-tabs">
              {allTabs.map((id) => {
                const tab = getRankingTab(id);
                if (!tab) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`we-rank-tab${activeTab === id ? ' active' : ''}`}
                    onClick={() => setActiveTab(id)}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {current.type === 'guild' ? (
              <GuildRankingTable title={current.label} endpoint="guild" embedded />
            ) : (
              <RankingTable
                title={current.label}
                endpoint={current.id}
                scoreLabel={current.scoreLabel}
                enableSearch={current.type === 'character'}
                embedded
              />
            )}
          </div>
        </div>
      </SubPageLayout>
      <Footer />
    </div>
  );
}
