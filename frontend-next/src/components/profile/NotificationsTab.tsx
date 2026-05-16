'use client';
import * as React from 'react';
import { Bell, Smartphone, Package, CheckCircle, XCircle, Clock, UserCog, Loader2 } from 'lucide-react';
import { NotifPrefs, profileApi } from '@/services/profileApi';
import { Switch } from '@/components/ui/Switch';
import { notify } from '@/lib/notif';

interface EventConfig {
  key: keyof NotifPrefs;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const EVENTS: EventConfig[] = [
  { key: 'login_new_device',  label: 'Nuevo dispositivo',    description: 'Recibe un aviso cuando tu cuenta se use en un dispositivo que no habías usado antes.',      icon: Smartphone,  color: '#ff4d8d' },
  { key: 'role_changed',      label: 'Cambio de rol',        description: 'Notificación cuando un administrador cambia tu rol en el sistema.',                          icon: UserCog,     color: '#2dd4bf' },
  { key: 'aporte_received',   label: 'Aporte recibido',      description: 'Cuando alguien envía un aporte a tu cuenta para revisión.',                                  icon: Package,     color: '#25d366' },
  { key: 'aporte_aceptado',   label: 'Aporte aceptado',      description: 'Cuando un administrador acepta uno de tus aportes.',                                         icon: CheckCircle, color: '#25d366' },
  { key: 'aporte_rechazado',  label: 'Aporte rechazado',     description: 'Cuando un administrador rechaza uno de tus aportes con motivo.',                             icon: XCircle,     color: '#ff4d8d' },
  { key: 'aporte_pendiente',  label: 'Aporte pendiente',     description: 'Recordatorio cuando tienes un aporte pendiente de resolución.',                              icon: Clock,       color: '#f59e0b' },
];

export function NotificationsTab() {
  const [prefs, setPrefs] = React.useState<NotifPrefs | null>(null);
  const [saving, setSaving] = React.useState<keyof NotifPrefs | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    profileApi.getNotifications()
      .then(r => setPrefs(r.prefs))
      .catch(() => notify.error('No se pudieron cargar las preferencias'))
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (key: keyof NotifPrefs) => {
    if (!prefs || saving) return;
    const newVal = !prefs[key];
    setPrefs(p => p ? { ...p, [key]: newVal } : p);
    setSaving(key);
    try {
      const result = await profileApi.updateNotifications({ [key]: newVal });
      setPrefs(result.prefs);
    } catch {
      setPrefs(p => p ? { ...p, [key]: !newVal } : p);
      notify.error('No se pudo guardar la preferencia');
    } finally { setSaving(null); }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold text-foreground">Notificaciones por email</h3>
        <p className="text-xs text-muted mt-0.5">Activa o desactiva el email para cada tipo de evento. Los cambios se guardan automáticamente.</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {EVENTS.map(e => <div key={e.key} className="h-20 animate-pulse rounded-2xl bg-white/[0.04]" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {EVENTS.map(event => {
            const Icon = event.icon;
            const enabled = prefs?.[event.key] ?? true;
            const isSaving = saving === event.key;
            return (
              <div key={event.key} className="flex items-start gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 transition-colors hover:border-white/[0.12]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]"
                  style={{ borderColor: `${event.color}22`, background: `${event.color}10` }}>
                  <Icon className="h-4 w-4" style={{ color: event.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">{event.label}</p>
                  <p className="mt-0.5 text-xs text-muted leading-relaxed">{event.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />}
                  <Switch
                    checked={enabled}
                    onCheckedChange={() => toggle(event.key)}
                    disabled={isSaving}
                    aria-label={`Activar notificación de ${event.label}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-[#25d366]/15 bg-[#25d366]/5 p-4">
        <p className="flex items-start gap-2 text-xs text-[#a7f3c7]">
          <Bell className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>Las notificaciones se envían al email configurado en tu cuenta. Si no tienes email, los envíos quedan desactivados aunque los toggles estén activos.</span>
        </p>
      </div>
    </div>
  );
}
