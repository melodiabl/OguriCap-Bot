'use client';
import * as React from 'react';
import { ShieldCheck, LogOut, Key, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { profileApi, ProfileMe } from '@/services/profileApi';
import { notify } from '@/lib/notif';

export function SecurityTab() {
  const { logout } = useAuth();
  const [me, setMe] = React.useState<ProfileMe | null>(null);

  React.useEffect(() => {
    profileApi.getMe().then(setMe).catch(() => {});
  }, []);

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' }) : '—';

  const handleLogout = () => {
    notify.info('Cerrando sesión...');
    setTimeout(logout, 500);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold text-foreground">Seguridad de la cuenta</h3>
        <p className="text-xs text-muted mt-0.5">Revisa tu sesión activa y gestiona el acceso a tu cuenta.</p>
      </div>

      <div className="rounded-2xl border border-[#25d366]/20 bg-[#25d366]/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#25d366]" />
          <span className="text-sm font-black text-[#a7f3c7] uppercase tracking-[0.14em]">Sesión activa</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[11px] text-muted uppercase tracking-[0.14em] font-bold">Último acceso</p>
            <p className="mt-0.5 font-semibold text-foreground">{formatDate(me?.last_login ?? null)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted uppercase tracking-[0.14em] font-bold">IP registrada</p>
            <p className="mt-0.5 font-semibold text-foreground font-mono text-sm">{me?.login_ip || '—'}</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#2dd4bf]/15 bg-[#2dd4bf]/8">
            <Key className="h-4 w-4 text-[#2dd4bf]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">Cambiar contraseña</p>
            <p className="text-xs text-muted">Ve a Configuración del panel para cambiar tu contraseña.</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#ff4d8d]/15 bg-[#ff4d8d]/8">
            <Lock className="h-4 w-4 text-[#ff4d8d]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">Dispositivos de confianza</p>
            <p className="text-xs text-muted">Gestiona los dispositivos en el tab "Dispositivos".</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-4 rounded-2xl border border-[#ff4d8d]/20 bg-[#ff4d8d]/5 p-4 text-left transition-colors hover:border-[#ff4d8d]/35 hover:bg-[#ff4d8d]/8"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#ff4d8d]/20 bg-[#ff4d8d]/10">
            <LogOut className="h-4 w-4 text-[#ff4d8d]" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#ff9fbd]">Cerrar sesión</p>
            <p className="text-xs text-[#ff4d8d]/60">Finaliza tu sesión en este dispositivo.</p>
          </div>
        </button>
      </div>
    </div>
  );
}
