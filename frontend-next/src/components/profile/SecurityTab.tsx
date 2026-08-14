'use client';
import * as React from 'react';
import { ShieldCheck, LogOut, Key, Eye, EyeOff, Loader2, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { profileApi, ProfileMe } from '@/services/profileApi';
import { notify } from '@/lib/notif';

export function SecurityTab() {
  const { logout } = useAuth();
  const [me, setMe] = React.useState<ProfileMe | null>(null);

  // Change-password form
  const [currentPwd, setCurrentPwd] = React.useState('');
  const [newPwd, setNewPwd] = React.useState('');
  const [confirmPwd, setConfirmPwd] = React.useState('');
  const [showCurrent, setShowCurrent] = React.useState(false);
  const [showNew, setShowNew] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [pwdError, setPwdError] = React.useState('');
  const [pwdOk, setPwdOk] = React.useState(false);

  React.useEffect(() => {
    profileApi.getMe().then(setMe).catch(() => {});
  }, []);

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' }) : '—';

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdOk(false);

    if (!currentPwd || !newPwd || !confirmPwd) {
      setPwdError('Completa todos los campos.');
      return;
    }
    if (newPwd.length < 6) {
      setPwdError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError('Las contraseñas no coinciden.');
      return;
    }
    if (newPwd === currentPwd) {
      setPwdError('La nueva contraseña debe ser diferente a la actual.');
      return;
    }

    setSaving(true);
    try {
      await profileApi.changePassword(currentPwd, newPwd);
      setPwdOk(true);
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      notify.success('Contraseña cambiada correctamente');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Error al cambiar la contraseña';
      setPwdError(msg);
      notify.error(msg);
    } finally {
      setSaving(false);
    }
  };

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

      {/* Active session */}
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

      {/* Change password form */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Key className="h-4 w-4 text-[#2dd4bf]" />
          <span className="text-sm font-black text-foreground uppercase tracking-[0.12em]">Cambiar contraseña</span>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-3">
          {/* Current password */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Contraseña actual</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPwd}
                onChange={e => setCurrentPwd(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted/40 focus:border-[#2dd4bf]/40 focus:outline-none focus:ring-1 focus:ring-[#2dd4bf]/20 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Nueva contraseña</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                placeholder="Mín. 6 caracteres"
                autoComplete="new-password"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted/40 focus:border-[#2dd4bf]/40 focus:outline-none focus:ring-1 focus:ring-[#2dd4bf]/20 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Confirmar nueva contraseña</label>
            <input
              type="password"
              value={confirmPwd}
              onChange={e => setConfirmPwd(e.target.value)}
              placeholder="Repite la nueva contraseña"
              autoComplete="new-password"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-foreground placeholder:text-muted/40 focus:border-[#2dd4bf]/40 focus:outline-none focus:ring-1 focus:ring-[#2dd4bf]/20 transition-colors"
            />
          </div>

          {pwdError && (
            <p className="text-xs text-[#ff9fbd] bg-[#ff4d8d]/10 border border-[#ff4d8d]/20 rounded-lg px-3 py-2">{pwdError}</p>
          )}
          {pwdOk && (
            <p className="flex items-center gap-1.5 text-xs text-[#a7f3c7] bg-[#25d366]/10 border border-[#25d366]/20 rounded-lg px-3 py-2">
              <Check className="h-3.5 w-3.5 shrink-0" />
              Contraseña cambiada correctamente
            </p>
          )}

          <button
            type="submit"
            disabled={saving || !currentPwd || !newPwd || !confirmPwd}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#2dd4bf]/15 border border-[#2dd4bf]/25 px-4 py-2 text-sm font-bold text-[#2dd4bf] transition-colors hover:bg-[#2dd4bf]/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
            {saving ? 'Guardando...' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>

      {/* Logout */}
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
  );
}
