'use client';

import React, { useRef } from 'react';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { Bell, Menu, Search, X } from 'lucide-react';

import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { Tooltip } from '@/components/ui/Tooltip';
import { useNotifications } from '@/contexts/NotificationContext';
import { NAV_ITEMS, NAV_SECTIONS } from '@/lib/navigation';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onMenuClick: () => void;
  sidebarOpen: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, sidebarOpen }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const { unreadCount, isOpen, setIsOpen, toggleOpen } = useNotifications();
  const reduceMotion = useReducedMotion();

  const currentPage = NAV_ITEMS.find((item) => item.path === pathname);
  const currentSection = NAV_SECTIONS.find((s) => s.key === currentPage?.section);

  return (
    <header className="sticky top-0 z-50 h-11 w-full flex items-center border-b border-[#27272a] bg-[#0c0c0e] px-4 flex-shrink-0">
      {/* Mobile menu button */}
      <div className="lg:hidden mr-3">
        <button
          onClick={onMenuClick}
          className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-[#27272a] transition-colors"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm flex-1 min-w-0">
        {currentSection && (
          <>
            <span className="text-zinc-600 truncate hidden sm:inline">{currentSection.label}</span>
            <span className="text-zinc-700 hidden sm:inline">/</span>
          </>
        )}
        <span className="font-semibold text-zinc-200 truncate">
          {currentPage?.headerLabel || currentPage?.label || 'Panel'}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Ghost search */}
        <div className="hidden sm:flex items-center gap-2 h-7 px-3 rounded border border-[#27272a] bg-[#18181b] text-zinc-600 text-xs cursor-default">
          <Search className="h-3 w-3" />
          <span>Buscar...</span>
          <kbd className="text-[10px] bg-[#27272a] px-1 rounded font-mono">⌘K</kbd>
        </div>

        {/* Notifications */}
        <div className="relative">
          <Tooltip content="Notificaciones" side="bottom">
            <button
              ref={buttonRef}
              onClick={toggleOpen}
              className={cn(
                'relative flex items-center justify-center h-7 w-7 rounded border transition-colors',
                unreadCount > 0
                  ? 'border-[#25d366]/30 bg-[#25d366]/10 text-[#25d366]'
                  : 'border-[#27272a] bg-transparent text-zinc-500 hover:bg-[#18181b] hover:text-zinc-300'
              )}
            >
              <motion.div
                animate={
                  !reduceMotion && unreadCount > 0
                    ? { rotate: [0, -10, 10, -6, 6, 0] }
                    : { rotate: 0 }
                }
                transition={
                  !reduceMotion && unreadCount > 0
                    ? { duration: 0.6, ease: 'easeOut', repeat: Infinity, repeatDelay: 4 }
                    : undefined
                }
              >
                <Bell className="h-4 w-4" />
              </motion.div>
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#25d366] px-1 text-[9px] font-bold text-black"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </motion.span>
              )}
            </button>
          </Tooltip>

          <NotificationDropdown isOpen={isOpen} onClose={() => setIsOpen(false)} buttonRef={buttonRef} />
        </div>
      </div>
    </header>
  );
};
