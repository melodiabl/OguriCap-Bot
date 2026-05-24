'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useBotGlobalState } from '@/contexts/BotGlobalStateContext';
import { useGlobalUpdate } from '@/contexts/GlobalUpdateContext';
import { useSocketBotStatus } from '@/contexts/SocketContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useBotStatus } from '@/hooks/useRealTime';
import { NAV_ITEMS, NAV_SECTIONS, type NavSectionKey } from '@/lib/navigation';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const pathname = usePathname();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { isConnected: pollingConnected, isConnecting } = useBotStatus();
  const botStatus = useSocketBotStatus();

  const { isGloballyOn } = useBotGlobalState();
  const { dashboardStats, botStatus: globalBotStatus, activeAlertCount } = useGlobalUpdate();
  const [collapsed, setCollapsed] = useState<Set<NavSectionKey>>(new Set());

  const isConnected = botStatus?.connected ?? globalBotStatus?.connected ?? pollingConnected;

  const sections = useMemo(() => {
    const allowed = NAV_ITEMS.filter((item) => hasPermission(item.pageKey));
    return NAV_SECTIONS.map((sec) => ({
      ...sec,
      items: allowed.filter((i) => i.section === sec.key),
    })).filter((sec) => sec.items.length > 0);
  }, [hasPermission]);

  const toggleSection = (key: NavSectionKey) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const getBadge = (path: string): number | null => {
    if (path === '/subbots') return dashboardStats?.subbots?.total ?? null;
    if (path === '/pedidos') return dashboardStats?.pedidosPendientes ?? null;
    if (path === '/alertas') return activeAlertCount > 0 ? activeAlertCount : null;
    return null;
  };

  const botDot = !isGloballyOn ? 'bg-zinc-600' : isConnecting ? 'bg-amber-400' : isConnected ? 'bg-[#25d366]' : 'bg-red-500';

  const SidebarContent = (
    <div className="relative flex h-full flex-col bg-[#0c0c0e] border-r border-[#27272a]">
      {/* Brand header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[#27272a]">
        <div className="relative h-8 w-8 flex-shrink-0">
          <Image
            src="/oguricap-avatar.png"
            alt="OguriCap"
            width={32}
            height={32}
            className="rounded-lg object-cover"
            priority
          />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-zinc-50 leading-none truncate">OguriCap Bot</div>
          <div className="text-[10px] text-zinc-600 mt-0.5 font-medium">v1.8.2 · {user?.rol || 'admin'}</div>
        </div>
        {/* Bot status dot */}
        <div className={cn('ml-auto w-2 h-2 rounded-full flex-shrink-0', botDot)} />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {sections.map((section) => {
          const isCollapsed = collapsed.has(section.key);
          return (
            <div key={section.key} className="mb-1">
              <button
                onClick={() => toggleSection(section.key)}
                className="flex w-full items-center justify-between px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                {section.label}
                <ChevronDown
                  className={cn('h-3 w-3 transition-transform text-zinc-700', isCollapsed && '-rotate-90')}
                />
              </button>

              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    {section.items.map((item) => {
                      const isActive = pathname === item.path;
                      const badge = getBadge(item.path);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.path}
                          href={item.path}
                          onClick={onClose}
                          className={cn(
                            'flex items-center gap-2.5 rounded-md py-2 text-sm transition-colors duration-100 group',
                            isActive
                              ? 'bg-[#27272a] text-zinc-50 font-semibold border-l-2 border-[#25d366] pl-[10px] pr-2.5'
                              : 'text-zinc-500 hover:bg-[#18181b] hover:text-zinc-300 px-2.5'
                          )}
                        >
                          <Icon
                            className={cn(
                              'h-4 w-4 flex-shrink-0',
                              isActive ? 'text-[#25d366]' : 'text-zinc-600 group-hover:text-zinc-400'
                            )}
                          />
                          <span className="flex-1 truncate">{item.label}</span>
                          {badge !== null && badge > 0 && (
                            <span className={cn(
                              'text-[10px] font-bold px-1.5 py-0.5 rounded',
                              item.path === '/alertas'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-[#25d366]/15 text-[#25d366]'
                            )}>
                              {badge > 99 ? '99+' : badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-[100dvh] w-64 transition-transform duration-300 ease-out lg:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {SidebarContent}
      </aside>

      {/* Desktop fixed sidebar */}
      <aside className="hidden lg:flex lg:fixed lg:left-0 lg:top-0 lg:h-[100dvh] lg:w-64 lg:z-30">
        {SidebarContent}
      </aside>
    </>
  );
};
