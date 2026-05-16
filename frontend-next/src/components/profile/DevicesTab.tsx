'use client';
import * as React from 'react';
import { Monitor, Smartphone, Globe, Trash2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Device, profileApi } from '@/services/profileApi';
import { notify } from '@/lib/notif';
import { cn } from '@/lib/utils';

function DeviceIcon({ os }: { os: string }) {
  if (/android|ios|iphone|ipad/i.test(os)) return <Smartphone className="h-5 w-5" />;
  return <Monitor className="h-5 w-5" />;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return 'Ahora mismo';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `Hace ${days} día${days !== 1 ? 's' : ''}`;
}

export function DevicesTab() {
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [revoking, setRevoking] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const { devices } = await profileApi.getDevices();
      setDevices(devices.sort((a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()));
    } catch { notify.error('No se pudieron cargar los dispositivos'); }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const revoke = async (hash: string) => {
    setRevoking(hash);
    try {
      await profileApi.revokeDevice(hash);
      setDevices(prev => prev.filter(d => d.hash !== hash));
      notify.success('Dispositivo eliminado');
    } catch { notify.error('No se pudo revocar el dispositivo'); }
    finally { setRevoking(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-foreground">Dispositivos conocidos</h3>
          <p className="text-xs text-muted mt-0.5">Dispositivos desde los que has iniciado sesión. Revoca los que no reconozcas.</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground transition-colors">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Actualizar
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      ) : devices.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Globe className="h-10 w-10 text-muted/40" />
          <p className="text-sm font-semibold text-muted">No hay dispositivos registrados aún.</p>
          <p className="text-xs text-muted/60">Se registran automáticamente al iniciar sesión.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {devices.map((device, i) => (
            <div key={device.hash} className={cn(
              'group flex items-center gap-4 rounded-2xl border p-4 transition-all',
              i === 0
                ? 'border-[#25d366]/25 bg-[#25d366]/5'
                : 'border-white/[0.07] bg-white/[0.025] hover:border-white/[0.12]'
            )}>
              <div className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
                i === 0 ? 'border-[#25d366]/20 bg-[#25d366]/10 text-[#25d366]' : 'border-white/10 bg-white/[0.04] text-muted'
              )}>
                <DeviceIcon os={device.os} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground truncate">{device.browser} — {device.os}</span>
                  {i === 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#25d366]/25 bg-[#25d366]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#a7f3c7]">
                      <ShieldCheck className="h-2.5 w-2.5" />
                      Este dispositivo
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
                  <span>IP: {device.ip}</span>
                  <span>·</span>
                  <span>Último acceso: {timeAgo(device.last_seen)}</span>
                  <span>·</span>
                  <span>Registrado: {new Date(device.first_seen).toLocaleDateString('es-ES')}</span>
                </div>
              </div>
              {i > 0 && (
                <button
                  onClick={() => revoke(device.hash)}
                  disabled={revoking === device.hash}
                  className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-muted opacity-0 transition-all group-hover:opacity-100 hover:border-[#ff4d8d]/30 hover:bg-[#ff4d8d]/10 hover:text-[#ff4d8d] disabled:opacity-40"
                  title="Revocar dispositivo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-[#ff4d8d]/15 bg-[#ff4d8d]/5 p-4">
        <p className="text-xs text-[#ff9fbd]">
          <strong className="font-black">Seguridad:</strong> Si ves un dispositivo que no reconoces, revócalo y cambia tu contraseña inmediatamente.
        </p>
      </div>
    </div>
  );
}
