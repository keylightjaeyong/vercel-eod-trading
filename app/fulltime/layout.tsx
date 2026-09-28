'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface FulltimeLayoutProps {
  children: React.ReactNode;
}

export default function FulltimeLayout({ children }: FulltimeLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-gray-900">
      {/* 사이드바 */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gray-800 border-r border-gray-700 transition-all duration-300 flex flex-col`}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700">
          {sidebarOpen && (
            <h1 className="text-xl font-bold text-white">풀타임 거래</h1>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-700 rounded-lg text-gray-300"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 px-2 py-4 space-y-2">
          <NavLink
            href="/fulltime"
            icon="📊"
            label="대시보드"
            sidebarOpen={sidebarOpen}
          />
          <NavLink
            href="/fulltime/stocks"
            icon="🏷️"
            label="종목 관리"
            sidebarOpen={sidebarOpen}
          />
          <NavLink
            href="/fulltime/allocation"
            icon="💰"
            label="금액 할당"
            sidebarOpen={sidebarOpen}
          />
          <NavLink
            href="/fulltime/settings"
            icon="⚙️"
            label="파라미터 설정"
            sidebarOpen={sidebarOpen}
          />
          <NavLink
            href="/fulltime/history"
            icon="📈"
            label="거래 이력"
            sidebarOpen={sidebarOpen}
          />
          <NavLink
            href="/fulltime/analysis"
            icon="📊"
            label="거래 분석"
            sidebarOpen={sidebarOpen}
          />
        </nav>

        {/* 푸터 */}
        <div className="border-t border-gray-700 p-4">
          {sidebarOpen && (
            <div className="text-xs text-gray-400">
              <p>Vercel Fulltime Trading</p>
              <p>© 2026</p>
            </div>
          )}
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 overflow-auto">
        <div className="h-full bg-gray-900 text-white">
          {children}
        </div>
      </main>
    </div>
  );
}

interface NavLinkProps {
  href: string;
  icon: string;
  label: string;
  sidebarOpen: boolean;
}

function NavLink({ href, icon, label, sidebarOpen }: NavLinkProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors text-gray-300 hover:text-white"
    >
      <span className="text-xl">{icon}</span>
      {sidebarOpen && <span>{label}</span>}
    </Link>
  );
}
