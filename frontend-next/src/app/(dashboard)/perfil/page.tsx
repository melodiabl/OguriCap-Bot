'use client';
import * as React from 'react';
import { User, Monitor, Bell, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { AccountTab } from '@/components/profile/AccountTab';
import { DevicesTab } from '@/components/profile/DevicesTab';
import { NotificationsTab } from '@/components/profile/NotificationsTab';
import { SecurityTab } from '@/components/profile/SecurityTab';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'cuenta',          label: 'Cuenta',          icon: User,    Component: AccountTab },
  { id: 'dispositivos',    label: 'Dispositivos',     icon: Monitor, Component: DevicesTab },
  { id: 'notificaciones',  label: 'Notificaciones',   icon: Bell,    Component: NotificationsTab },
  { id: 'seguridad',       label: 'Seguridad',        icon: Shield,  Component: SecurityTab },
] as const;

type TabId = typeof TABS[number]['id'];

export default function PerfilPage() {
  const [activeTab, setActiveTab] = React.useState<TabId>('cuenta');
  const ActiveComponent = TABS.find(t => t.id === activeTab)?.Component ?? AccountTab;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">Mi Perfil</h1>
        <p className="mt-1 text-sm text-muted">Gestiona tu cuenta, dispositivos y preferencias de notificación.</p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <nav className="hidden lg:flex lg:w-52 lg:shrink-0 lg:flex-col lg:gap-1 lg:rounded-2xl lg:border lg:border-white/10 lg:bg-[#0f1a14]/60 lg:p-2">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all',
                  active
                    ? 'bg-[#25d366]/12 text-[#25d366] border border-[#25d366]/20'
                    : 'text-muted hover:bg-white/[0.04] hover:text-foreground border border-transparent'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="flex gap-1 overflow-x-auto pb-1 lg:hidden">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all whitespace-nowrap',
                  active
                    ? 'bg-[#25d366]/12 text-[#25d366] border border-[#25d366]/20'
                    : 'border border-white/10 bg-white/[0.03] text-muted hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-[#0f1a14]/40 p-5 sm:p-6"
        >
          <ActiveComponent />
        </motion.div>
      </div>
    </div>
  );
}
