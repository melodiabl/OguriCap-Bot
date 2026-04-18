import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useBotStatus, useConnectionHealth } from '@/hooks/useRealTime';
import { RealTimeBadge } from '@/components/ui/StatusIndicator';
import { FloatingSupportButton } from '@/components/ui/FloatingSupportButton';
import { RouteProgressBar } from '@/components/motion/RouteProgressBar';
import { cn } from '@/lib/utils';
import { getPageKeyFromPathname } from '@/lib/pageTheme';

export const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { isConnected } = useBotStatus();
  const { latency } = useConnectionHealth();
  const pageKey = getPageKeyFromPathname(pathname);
  const mainScrollRef = React.useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = mainScrollRef.current;
    if (!node) return;
    node.scrollTop = 0;
    node.scrollLeft = 0;
  }, [pathname]);

  return (
    <div className="h-screen w-full overflow-hidden bg-[#060807] text-foreground flex" data-page={pageKey}>
      <RouteProgressBar />

      {/* Performant static background layer instead of heavy blurred motion divs */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,211,102,0.06),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(45,212,191,0.06),transparent_40%)]" />
        <div className="absolute inset-0 opacity-[0.12] bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col relative z-10 w-full min-w-0 lg:pl-72 h-screen overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />

        <main ref={mainScrollRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-6 pb-24">
          <div className="mx-auto w-full max-w-[1500px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="relative min-h-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        <FloatingSupportButton />

        <footer className="border-t border-white/5 bg-[#080b09]/80 backdrop-blur-md px-4 py-3 lg:px-8 shrink-0">
          <div className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center justify-between gap-3 text-xs text-white/50">
            <div className="flex items-center gap-2">
              <span className="font-medium">© 2026 OguriCap Bot</span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <span className="hidden font-mono sm:inline">v1.0.0</span>
              <RealTimeBadge isActive={isConnected} latency={latency} />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
