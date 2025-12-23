'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { GroupsProvider } from '@/contexts/GroupsContext';
import { BotGlobalStateProvider } from '@/contexts/BotGlobalStateContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { MaintenanceBanner } from '@/components/ui/MaintenanceBanner';
import { motion } from 'framer-motion';
import { Bot } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            className="w-16 h-16 mx-auto mb-4 border-4 border-primary-500/30 border-t-primary-500 rounded-full"
          />
          <p className="text-gray-400">Verificando autenticación...</p>
        </motion.div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <BotGlobalStateProvider>
      <GroupsProvider>
        <div className="min-h-screen">
          <MaintenanceBanner />
          <MainLayout>{children}</MainLayout>
        </div>
      </GroupsProvider>
    </BotGlobalStateProvider>
  );
}