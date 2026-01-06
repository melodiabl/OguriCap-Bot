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
      <div className="min-h-screen mesh-bg flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="ultra-card ultra-card--glow ultra-card--interactive p-10 text-center w-full max-w-md"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
            className="w-16 h-16 mx-auto mb-5 rounded-3xl border border-white/15 bg-white/5 shadow-glow-lg flex items-center justify-center"
          >
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-primary-500 via-violet-600 to-cyan-500 shadow-glow" />
          </motion.div>
          <p className="text-sm font-black tracking-[0.22em] uppercase text-gray-400">Cargando</p>
          <p className="mt-2 text-xl font-extrabold text-white tracking-tight">Verificando autenticacion...</p>
          <div className="mt-6 progress-bar">
            <div className="progress-bar-fill w-[70%]" />
          </div>
        </motion.div>
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
