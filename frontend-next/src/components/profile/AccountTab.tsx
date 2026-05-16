'use client';
import * as React from 'react';
import { User, Mail, Shield, Clock, MapPin } from 'lucide-react';
import { ProfileAvatar } from '@/components/user/ProfileAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { profileApi, ProfileMe } from '@/services/profileApi';
import { cn } from '@/lib/utils';

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-3 py-3.5 border-b border-white/[0.06] last:border-0">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#25d366]/10 border border-[#25d366]/15">
        <Icon className="h-4 w-4 text-[#25d366]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{value || '—'}</p>
      </div>
    </div>
  );
}

export function AccountTab() {
  const { user } = useAuth();
  const [me, setMe] = React.useState<ProfileMe | null>(null);

  React.useEffect(() => {
    profileApi.getMe().then(setMe).catch(() => {});
  }, []);

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="relative">
          <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-[#25d366]/20 via-[#2dd4bf]/10 to-[#ff4d8d]/10 blur-xl" />
          <div className="relative">
            <ProfileAvatar editable size="lg" />
          </div>
        </div>
        <div className="text-center sm:text-left">
          <h2 className="text-2xl font-black tracking-tight text-foreground">{user?.username}</h2>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#25d366]/20 bg-[#25d366]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#a7f3c7]">
            <Shield className="h-3 w-3" />
            {user?.rol}
          </span>
          <p className="mt-2 text-xs text-muted">Haz clic en el avatar para cambiar tu foto de perfil.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0f1a14]/60 p-4">
        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-[#25d366]">Información de la cuenta</p>
        <InfoRow icon={User} label="Usuario" value={user?.username ?? null} />
        <InfoRow icon={Mail} label="Email" value={me?.email ?? null} />
        <InfoRow icon={Shield} label="Rol asignado" value={me?.rol ?? null} />
        <InfoRow icon={Clock} label="Último acceso" value={formatDate(me?.last_login ?? null)} />
        <InfoRow icon={MapPin} label="Última IP" value={me?.login_ip ?? null} />
        <InfoRow icon={Clock} label="Miembro desde" value={formatDate(me?.fecha_registro ?? null)} />
      </div>

      <div className="rounded-xl border border-[#2dd4bf]/15 bg-[#2dd4bf]/5 p-4 text-sm text-[#2dd4bf]">
        <strong className="font-black">Tip:</strong> Para cambiar tu contraseña ve a <span className="font-mono text-xs">Configuración → Seguridad</span>. Para actualizar tu email contacta a un administrador.
      </div>
    </div>
  );
}
