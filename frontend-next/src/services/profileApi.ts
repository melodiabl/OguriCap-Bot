import api from './api';

export interface Device {
  hash: string;
  ip: string;
  browser: string;
  os: string;
  model?: string | null;
  first_seen: string;
  last_seen: string;
}

export interface NotifPrefs {
  login_new_device: boolean;
  aporte_received: boolean;
  aporte_aceptado: boolean;
  aporte_rechazado: boolean;
  aporte_pendiente: boolean;
  role_changed: boolean;
}

export interface ProfileMe {
  username: string;
  email: string | null;
  rol: string;
  last_login: string | null;
  login_ip: string | null;
  fecha_registro: string | null;
}

export const profileApi = {
  getMe: (): Promise<ProfileMe> =>
    api.get('/api/profile/me').then(r => r.data),

  heartbeatDevice: async (): Promise<{ ok: boolean; hash: string }> => {
    const body: Record<string, string> = {};
    try {
      const nav = navigator as any;
      if (nav.userAgentData?.getHighEntropyValues) {
        const hints = await nav.userAgentData.getHighEntropyValues(['model', 'platform']);
        if (hints.model && hints.model !== 'K') body.uaHintModel = hints.model;
        if (hints.platform) body.uaHintPlatform = hints.platform;
      }
    } catch {}
    return api.post('/api/profile/devices/heartbeat', body).then(r => r.data);
  },

  getDevices: (): Promise<{ devices: Device[] }> =>
    api.get('/api/profile/devices').then(r => r.data),

  revokeDevice: (hash: string): Promise<void> =>
    api.delete(`/api/profile/devices/${hash}`).then(() => undefined),

  getNotifications: (): Promise<{ prefs: NotifPrefs }> =>
    api.get('/api/profile/notifications').then(r => r.data),

  updateNotifications: (prefs: Partial<NotifPrefs>): Promise<{ prefs: NotifPrefs }> =>
    api.put('/api/profile/notifications', prefs).then(r => r.data),

  changePassword: (currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> =>
    api.post('/api/auth/change-password', { currentPassword, newPassword }).then(r => r.data),
};
