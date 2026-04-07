'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { GroupsProvider } from '@/contexts/GroupsContext';
import { BotGlobalStateProvider } from '@/contexts/BotGlobalStateContext';
import { GlobalUpdateProvider } from '@/contexts/GlobalUpdateContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { MaintenanceBanner } from '@/components/ui/MaintenanceBanner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-background px-6 py-10 text-foreground">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(var(--primary),0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(var(--accent),0.12),transparent_34%)]" />
        <div className="relative flex min-h-[80vh] items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-md overflow-hidden rounded-[30px] border border-white/10 bg-card/70 p-10 text-center shadow-[0_28px_90px_-40px_rgba(0,0,0,0.78)] backdrop-blur-2xl"
        >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-primary/10" />
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <div className="relative z-10">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
                className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl border border-white/15 bg-white/5 shadow-glow-oguri-mixed"
          >
                <div className="h-9 w-9 rounded-2xl bg-gradient-oguri-primary shadow-glow-oguri-purple" />
          </motion.div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-oguri-lavender/70">Cargando</p>
              <p className="mt-2 text-xl font-extrabold tracking-tight text-white">Verificando autenticacion...</p>
              <div className="mt-6 overflow-hidden rounded-full border border-white/10 bg-white/[0.04] p-1">
                <motion.div
                  className="h-2 rounded-full bg-gradient-to-r from-primary via-secondary to-accent shadow-glow-oguri-purple"
                  animate={{ x: ['-18%', '18%', '-18%'] }}
                  transition={{ repeat: Infinity, duration: 2.1, ease: 'easeInOut' }}
                  style={{ width: '72%' }}
                />
              </div>
            </div>
        </motion.div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <BotGlobalStateProvider>
      <GlobalUpdateProvider>
        <GroupsProvider>
          <div className="min-h-screen">
            <MaintenanceBanner />
            <MainLayout>{children}</MainLayout>
          </div>
        </GroupsProvider>
      </GlobalUpdateProvider>
    </BotGlobalStateProvider>
  );
}
