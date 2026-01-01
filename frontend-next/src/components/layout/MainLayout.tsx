import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useBotStatus, useConnectionHealth } from '@/hooks/useRealTime';
import { RealTimeBadge } from '@/components/ui/StatusIndicator';
import { FloatingSupportButton } from '@/components/ui/FloatingSupportButton';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { isConnected } = useBotStatus(5000);
  const { latency } = useConnectionHealth();
  const reduceMotion = useReducedMotion();

  return (
    <div className="h-screen overflow-hidden mesh-bg">
      {/* Animated background particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div
          className={cn(
            'absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl',
            !reduceMotion && 'animate-blob'
          )}
        />
        <div
          className={cn(
            'absolute top-3/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl',
            !reduceMotion && 'animate-blob animation-delay-2000'
          )}
        />
        <div
          className={cn(
            'absolute bottom-1/4 left-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl',
            !reduceMotion && 'animate-blob animation-delay-4000'
          )}
        />
      </div>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="lg:pl-72 h-screen flex flex-col relative z-10 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={reduceMotion ? false : { opacity: 0, y: 16, filter: 'blur(6px)' }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, filter: 'blur(6px)' }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        <FloatingSupportButton />

        {/* Footer */}
        <footer className="px-6 py-4 border-t border-white/10">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>© 2025 Oguri Bot Panel</span>
            <div className="flex items-center gap-4">
              <span>v1.0.0</span>
              <RealTimeBadge isActive={isConnected} latency={latency} />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

