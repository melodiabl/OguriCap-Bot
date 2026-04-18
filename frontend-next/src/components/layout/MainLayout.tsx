import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useBotStatus, useConnectionHealth } from '@/hooks/useRealTime';
import { RealTimeBadge } from '@/components/ui/StatusIndicator';
import { FloatingSupportButton } from '@/components/ui/FloatingSupportButton';
import { RouteProgressBar } from '@/components/motion/RouteProgressBar';
import { cn } from '@/lib/utils';
import { getPageKeyFromPathname } from '@/lib/pageTheme';
import { useDevicePerformance } from '@/contexts/DevicePerformanceContext';

const AMBIENT_PARTICLES = [
  { className: 'left-[7%] top-[16%] h-2 w-2', tone: 'bg-primary/80', duration: 8.5, delay: 0 },
  { className: 'left-[14%] top-[56%] h-1.5 w-1.5', tone: 'bg-secondary/75', duration: 10.5, delay: 0.8 },
  { className: 'left-[32%] top-[24%] h-2.5 w-2.5', tone: 'bg-accent/75', duration: 9.4, delay: 1.3 },
  { className: 'left-[48%] top-[72%] h-2 w-2', tone: 'bg-primary/70', duration: 11.2, delay: 2.1 },
  { className: 'right-[18%] top-[18%] h-2.5 w-2.5', tone: 'bg-secondary/80', duration: 9.8, delay: 0.4 },
  { className: 'right-[10%] top-[48%] h-1.5 w-1.5', tone: 'bg-accent/80', duration: 8.2, delay: 1.7 },
  { className: 'right-[22%] bottom-[14%] h-2 w-2', tone: 'bg-primary/75', duration: 10.8, delay: 2.4 },
  { className: 'left-[22%] bottom-[12%] h-2.5 w-2.5', tone: 'bg-secondary/70', duration: 12.2, delay: 0.6 },
];

const STAR_PARTICLES = [
  { className: 'left-[4%] top-[10%] h-1 w-1', tone: 'bg-white/80', duration: 5.8, delay: 0 },
  { className: 'left-[11%] top-[28%] h-1.5 w-1.5', tone: 'bg-oguri-lavender/80', duration: 7.1, delay: 0.8 },
  { className: 'left-[18%] top-[68%] h-1 w-1', tone: 'bg-white/70', duration: 6.6, delay: 1.2 },
  { className: 'left-[34%] top-[16%] h-1.5 w-1.5', tone: 'bg-oguri-cyan/80', duration: 7.9, delay: 0.4 },
  { className: 'left-[42%] top-[46%] h-1 w-1', tone: 'bg-white/75', duration: 6.2, delay: 1.9 },
  { className: 'left-[48%] top-[78%] h-1.5 w-1.5', tone: 'bg-oguri-blue/80', duration: 8.3, delay: 1.5 },
  { className: 'right-[38%] top-[12%] h-1 w-1', tone: 'bg-white/80', duration: 5.9, delay: 0.2 },
  { className: 'right-[28%] top-[38%] h-1.5 w-1.5', tone: 'bg-oguri-gold/80', duration: 8.1, delay: 2.1 },
  { className: 'right-[16%] top-[16%] h-1 w-1', tone: 'bg-white/78', duration: 6.8, delay: 0.7 },
  { className: 'right-[10%] top-[56%] h-1.5 w-1.5', tone: 'bg-oguri-cyan/78', duration: 7.4, delay: 1.7 },
  { className: 'right-[6%] bottom-[18%] h-1 w-1', tone: 'bg-white/75', duration: 6.3, delay: 2.3 },
  { className: 'left-[26%] bottom-[8%] h-1.5 w-1.5', tone: 'bg-oguri-lavender/75', duration: 7.8, delay: 1.1 },
];

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { isConnected } = useBotStatus();
  const { latency } = useConnectionHealth();
  const reduceMotion = useReducedMotion();
  const { performanceMode, viewport, visualIntensity } = useDevicePerformance();
  const isLiteMode = performanceMode;
  const isUltraMode = visualIntensity === 'ultra';
  const pageKey = getPageKeyFromPathname(pathname);
  const mainScrollRef = React.useRef<HTMLElement | null>(null);

  const orbSize = viewport === 'mobile' ? 'h-64 w-64 blur-3xl' : viewport === 'tablet' ? 'h-80 w-80 blur-[88px]' : 'h-96 w-96 blur-[110px]';
  const auraClass = React.useMemo(() => {
    switch (pageKey) {
      case 'bot':
      case 'configuracion':
      case 'multimedia':
      case 'grupos-management':
        return 'aura-cyan';
      case 'subbots':
      case 'pedidos':
      case 'alertas':
        return 'aura-gold';
      case 'logs':
      case 'maintenance':
        return 'aura-phantom';
      default:
        return 'aura-purple';
    }
  }, [pageKey]);
  const shellClassName =
    'relative min-h-full overflow-visible rounded-none border-0 bg-transparent shadow-none';

  const stagedChildren = React.useMemo(() => {
    if (!children) return children;
    if (React.isValidElement(children) && children.type !== React.Fragment) {
      const existing = (children.props as any)?.className;
      return React.cloneElement(children as any, { className: cn('stagger-children', existing) });
    }
    return <div className="stagger-children">{children}</div>;
  }, [children]);

  React.useEffect(() => {
    const node = mainScrollRef.current;
    if (!node) return;
    node.scrollTop = 0;
    node.scrollLeft = 0;
  }, [pathname]);

  return (
    <div className="h-screen overflow-hidden bg-transparent text-foreground" data-page={pageKey}>
      <RouteProgressBar />
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="module-atmosphere" />
        <div className={cn('absolute inset-[-24%] aura-flow-layer opacity-[0.16]', auraClass)} />
        <div className={cn('absolute inset-[-30%] aura-flow-layer opacity-[0.10]', auraClass)} style={{ transform: 'scale(1.08)' }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(var(--primary),0.30),transparent_32%),radial-gradient(circle_at_top_right,rgba(var(--secondary),0.24),transparent_30%),radial-gradient(circle_at_bottom_center,rgba(var(--accent),0.20),transparent_34%),radial-gradient(circle_at_center,rgba(var(--page-d),0.12),transparent_42%)]" />
        <div className="absolute inset-0 opacity-[0.14] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:34px_34px]" />
        <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-white/[0.06] via-white/[0.02] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-primary/[0.10] via-secondary/[0.05] to-transparent" />
        <div className="absolute left-[-4%] top-[9%] h-[22rem] w-[22rem] rounded-full bg-[radial-gradient(circle,rgba(var(--primary),0.22),transparent_62%)] blur-[90px]" />
        <div className="absolute right-[-6%] top-[16%] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,rgba(var(--secondary),0.18),transparent_62%)] blur-[100px]" />
        <div className="absolute left-[26%] bottom-[-10%] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,rgba(var(--accent),0.14),transparent_62%)] blur-[110px]" />
        <motion.div
          aria-hidden="true"
          className="absolute left-[-8%] top-[18%] h-px w-[116%] bg-gradient-to-r from-transparent via-primary/35 to-transparent blur-[1px]"
          animate={reduceMotion || performanceMode ? { opacity: 0.35 } : { x: [-24, 18, -24], opacity: [0.18, 0.5, 0.18] }}
          transition={reduceMotion || performanceMode ? { duration: 0.1 } : { repeat: Infinity, duration: 9.5, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute right-[8%] top-[32%] h-px w-[42%] bg-gradient-to-r from-transparent via-secondary/30 to-transparent blur-[1px]"
          animate={reduceMotion || performanceMode ? { opacity: 0.24 } : { x: [16, -10, 16], opacity: [0.12, 0.38, 0.12] }}
          transition={reduceMotion || performanceMode ? { duration: 0.1 } : { repeat: Infinity, duration: 8.8, ease: 'easeInOut', delay: 0.6 }}
        />
        <motion.div
          aria-hidden="true"
          className={cn('absolute -left-20 top-16 rounded-full bg-primary/22', orbSize)}
          animate={reduceMotion || performanceMode ? { opacity: 0.78 } : { x: [0, 34, 0], y: [0, 28, 0], opacity: [0.5, 0.9, 0.5] }}
          transition={reduceMotion || performanceMode ? { duration: 0.1 } : { repeat: Infinity, duration: 11, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden="true"
          className={cn('absolute bottom-0 right-[-4rem] rounded-full bg-oguri-cyan/22', orbSize)}
          animate={reduceMotion || performanceMode ? { opacity: 0.68 } : { x: [0, -22, 0], y: [0, -26, 0], opacity: [0.38, 0.78, 0.38] }}
          transition={reduceMotion || performanceMode ? { duration: 0.1 } : { repeat: Infinity, duration: 9.5, ease: 'easeInOut', delay: 0.4 }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute right-[14%] top-[12%] h-48 w-48 rounded-full bg-secondary/16 blur-[82px]"
          animate={reduceMotion || performanceMode ? { opacity: 0.38 } : { x: [0, -16, 0], y: [0, 22, 0], opacity: [0.18, 0.42, 0.18] }}
          transition={reduceMotion || performanceMode ? { duration: 0.1 } : { repeat: Infinity, duration: 12.5, ease: 'easeInOut', delay: 0.2 }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute left-[18%] top-[8%] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(var(--page-b),0.14),transparent_62%)] blur-[96px]"
          animate={reduceMotion || performanceMode ? { opacity: 0.34 } : { x: [0, 20, -12, 0], y: [0, 18, 10, 0], opacity: [0.22, 0.4, 0.28, 0.22] }}
          transition={reduceMotion || performanceMode ? { duration: 0.1 } : { repeat: Infinity, duration: 16, ease: 'easeInOut', delay: 0.4 }}
        />
        {!performanceMode &&
          AMBIENT_PARTICLES.map((particle, index) => (
            <motion.div
              key={`${particle.className}-${index}`}
              aria-hidden="true"
              className={cn('absolute rounded-full shadow-[0_0_18px_rgba(255,255,255,0.18)]', particle.className, particle.tone)}
              animate={reduceMotion ? { opacity: 0.4 } : { y: [0, -18, 0], x: [0, index % 2 === 0 ? 8 : -8, 0], opacity: [0.2, 0.82, 0.2], scale: [0.9, 1.16, 0.9] }}
              transition={reduceMotion ? { duration: 0.1 } : { repeat: Infinity, duration: particle.duration, ease: 'easeInOut', delay: particle.delay }}
            />
          ))}
        {!performanceMode &&
          STAR_PARTICLES.map((star, index) => (
            <motion.div
              key={`star-${star.className}-${index}`}
              aria-hidden="true"
              className={cn('absolute rounded-full shadow-[0_0_12px_rgba(255,255,255,0.18)]', star.className, star.tone)}
              animate={reduceMotion ? { opacity: 0.5 } : { opacity: [0.18, isUltraMode ? 1 : 0.95, 0.18], scale: [0.8, isUltraMode ? 1.5 : 1.35, 0.8], y: [0, -6, 0] }}
              transition={reduceMotion ? { duration: 0.1 } : { repeat: Infinity, duration: star.duration, ease: 'easeInOut', delay: star.delay }}
            />
          ))}
        {isUltraMode && !performanceMode && (
          <motion.div
            aria-hidden="true"
            className="absolute inset-[-14%] bg-[conic-gradient(from_90deg_at_50%_50%,rgba(var(--page-a),0.12),transparent,rgba(var(--page-b),0.10),transparent,rgba(var(--page-c),0.10),transparent,rgba(var(--page-d),0.08))] mix-blend-screen"
            animate={reduceMotion ? { opacity: 0.18 } : { opacity: [0.12, 0.28, 0.16], scale: [0.98, 1.04, 1], rotate: [0, 6, 0] }}
            transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 14.5, ease: 'easeInOut' }}
          />
        )}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`route-atmosphere-${pathname}`}
            aria-hidden="true"
            className="absolute inset-[-15%] bg-[radial-gradient(circle_at_20%_30%,rgba(var(--page-a),0.32),transparent_35%),radial-gradient(circle_at_80%_25%,rgba(var(--page-b),0.26),transparent_35%),radial-gradient(circle_at_50%_90%,rgba(var(--page-c),0.22),transparent_38%),conic-gradient(from_120deg_at_50%_50%,rgba(var(--page-a),0.1),transparent,rgba(var(--page-b),0.1),transparent,rgba(var(--page-c),0.08))] mix-blend-screen blur-[2px]"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, rotate: -6 }}
            animate={reduceMotion ? { opacity: 0.18 } : { opacity: [0, 0.35, 0.16], scale: [0.9, 1.05, 1], rotate: [-6, 0.5, 4] }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.15, rotate: 6 }}
            transition={reduceMotion ? { duration: 0.2 } : { duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          />
        </AnimatePresence>
        
        {/* Texture Overlays */}
        <div className="absolute inset-0 z-[1] opacity-[0.035] pointer-events-none mix-blend-overlay bg-[url('/noise.png')]" />
        <div className="absolute inset-0 z-[2] opacity-[0.015] pointer-events-none mix-blend-overlay bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.08)_0_1px,transparent_1px_4px)]" />
      </div>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="lg:pl-72 h-screen flex flex-col relative z-10 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />

        <main ref={mainScrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-3 pt-3 pb-24 sm:px-4 sm:pt-4 sm:pb-28 lg:px-6 lg:pt-5 lg:pb-28">
          <div className="mx-auto w-full max-w-[1500px]">
            {isLiteMode ? (
              <div className={shellClassName}>
                <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-white/[0.05] via-transparent to-primary/10" />
                <div aria-hidden="true" className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                <div className="relative z-10">{stagedChildren}</div>
              </div>
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={pathname}
                  className={cn(shellClassName, 'page-perspective')}
                  initial={reduceMotion ? false : { opacity: 0, y: 22, scale: 0.985, rotateX: -3 }}
                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, rotateX: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.985, rotateX: 2.5 }}
                  transition={
                    reduceMotion
                      ? { duration: 0.14 }
                      : {
                          duration: 0.48,
                          ease: [0.22, 1, 0.36, 1],
                        }
                  }
                >
                  <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-white/[0.05] via-transparent to-primary/10" />
                  <div aria-hidden="true" className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                  <motion.div
                    aria-hidden="true"
                    className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent blur-2xl"
                    animate={reduceMotion ? { opacity: 0 } : { x: ['0%', '280%'] }}
                    transition={reduceMotion ? { duration: 0 } : { repeat: Infinity, duration: 8.5, ease: 'easeInOut' }}
                  />
                  <motion.div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/[0.06] to-accent/[0.08]"
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                    animate={reduceMotion ? { opacity: 0 } : { opacity: [0, 1, 0], scale: [0.98, 1.04, 1] }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                  />
                  {isUltraMode && (
                    <motion.div
                      aria-hidden="true"
                      className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.06)_28%,transparent_44%),repeating-linear-gradient(180deg,rgba(255,255,255,0.022)_0_1px,transparent_1px_5px)]"
                      animate={reduceMotion ? { opacity: 0.18 } : { opacity: [0.12, 0.26, 0.12] }}
                      transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 5.2, ease: 'easeInOut' }}
                    />
                  )}
                  <div className="relative z-10">{stagedChildren}</div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </main>

        <FloatingSupportButton />

        <footer className="border-t border-border/15 bg-background/35 px-4 py-4 backdrop-blur-xl lg:px-8">
          <div className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center justify-center gap-3 text-center text-sm text-[rgb(var(--text-secondary))] sm:justify-between sm:text-left">
            <div className="flex min-w-0 items-center gap-2">
              <div className="h-2 w-2 shrink-0 rounded-full bg-oguri-lavender animate-pulse" />
              <span className="min-w-0 font-medium">© 2026 OguriCap Bot Panel</span>
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-center gap-3 sm:justify-end">
              <span className="hidden text-xs font-mono text-[rgb(var(--text-secondary))] sm:inline">OGURICAP LIVE v1.0.0</span>
              <RealTimeBadge isActive={isConnected} latency={latency} />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
