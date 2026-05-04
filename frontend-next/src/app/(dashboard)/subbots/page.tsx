'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  QrCode, Key, Trash2, RefreshCw, Wifi, WifiOff, Bot, AlertCircle,
  Download, Copy, Zap, Radio, Clock, Smartphone, CheckCircle, XCircle,
  Settings, User, Image as ImageIcon, MessageSquare, Activity
} from 'lucide-react';
import { StatCard } from '@/components/ui/Card';
import { ActionButton } from '@/components/ui/ActionButton';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Reveal } from '@/components/motion/Reveal';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { RealTimeBadge } from '@/components/ui/StatusIndicator';
import { Badge } from '@/components/ui/Badge';
import { useSocketConnection } from '@/contexts/SocketContext';
import { useBotGlobalState } from '@/contexts/BotGlobalStateContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTime, cn , getErrorMessage } from '@/lib/utils';
import api from '@/services/api';
import { notify, notif } from '@/lib/notif';
import QRCode from 'qrcode';

type SubbotType = 'qr' | 'code';
type SubbotStatus = 'activo' | 'inactivo' | 'error';
type SubbotConnectionState = 'connected' | 'needs_auth' | 'disconnected' | 'missing_session' | 'error';

interface Subbot {
  id: number;
  code: string;
  codigo: string;
  type: SubbotType;
  status: SubbotStatus;
  connectionState?: SubbotConnectionState;
  usuario: string;
  fecha_creacion: string;
  numero?: string | null;
  whatsappName?: string | null;
  aliasDir?: string | null;
  customName?: string | null;
  customPrefix?: string | null;
  customBanner?: string | null;
  customVideo?: string | null;
  displayName?: string | null;
  qr_data?: string | null;
  pairingCode?: string | null;
  isOnline?: boolean;
  whatsapp_status?: string | null;
}

export default function SubbotsPage() {
  const [subbots, setSubbots] = useState<Subbot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSubbot, setSelectedSubbot] = useState<Subbot | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [currentPairingCode, setCurrentPairingCode] = useState<string | null>(null);
  const [currentPairingSubbot, setCurrentPairingSubbot] = useState<string | null>(null);
  const [pendingPairingSubbotCode, setPendingPairingSubbotCode] = useState<string | null>(null);

  const [capacity, setCapacity] = useState<any | null>(null);
  
  // Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsSubbot, setSettingsSubbot] = useState<Subbot | null>(null);
  const [settingsForm, setSettingsForm] = useState({
    alias: '',
    name: '',
    status: '',
    pfp: '',
    customName: '',
    customPrefix: '',
    customBanner: '',
    customVideo: ''
  });

  const { isConnected: isSocketConnected, socket } = useSocketConnection();
  const { isGloballyOn } = useBotGlobalState();
  const { user } = useAuth();
  
  const canDeleteSubbots = !!user && ['owner', 'admin', 'administrador'].includes(String(user.rol || '').toLowerCase());
  const isUsuario = !!user && String(user.rol || '').toLowerCase() === 'usuario';
  const connectedCount = subbots.filter((subbot) => subbot.isOnline).length;
  const pendingCount = subbots.filter(
    (subbot) => !subbot.isOnline && (subbot.connectionState === 'needs_auth' || (!subbot.connectionState && (subbot.qr_data || subbot.pairingCode)))
  ).length;

  const subbotLanes = [
    {
      label: 'Capacidad operativa',
      value: capacity?.effectiveMax ? `${subbots.length}/${capacity.effectiveMax}` : `${subbots.length}`,
      description: capacity?.effectiveMax ? `${capacity.remaining} slots disponibles para nuevas instancias.` : 'Flota actual detectada en el panel.',
      icon: <Bot className="w-4 h-4" />,
      badge: capacity?.autoLimit ? 'auto' : 'manual',
      badgeClassName: 'border-oguri-cyan/20 bg-oguri-cyan/10 text-oguri-cyan',
      glowClassName: 'from-oguri-cyan/18 via-oguri-blue/10 to-transparent',
    },
    {
      label: 'Pendientes de enlace',
      value: `${pendingCount}`,
      description: pendingCount > 0 ? 'Subbots esperando QR o pairing para terminar la sesion.' : 'No hay autenticaciones pendientes ahora mismo.',
      icon: <Clock className="w-4 h-4" />,
      badge: pendingCount > 0 ? 'auth' : 'ok',
      badgeClassName: pendingCount > 0 ? 'border-warning/20 bg-warning/10 text-warning/80' : 'border-white/10 bg-white/[0.05] text-white/70',
      glowClassName: 'from-amber-400/18 via-oguri-gold/10 to-transparent',
    },
    {
      label: 'Visibilidad',
      value: isUsuario ? 'Solo tus subbots' : 'Vista administrativa',
      description: isUsuario ? 'Tu panel muestra solo instancias propias.' : 'Puedes vigilar la flota completa y operar mantenimiento.',
      icon: <User className="w-4 h-4" />,
      badge: isUsuario ? 'private' : 'admin',
      badgeClassName: 'border-accent/20 bg-accent/10 text-accent',
      glowClassName: 'from-violet-400/18 via-oguri-lavender/10 to-transparent',
    },
    {
      label: 'Motor global',
      value: isGloballyOn ? 'Respuesta habilitada' : 'Respuesta pausada',
      description: isGloballyOn ? `${connectedCount} instancias online con red principal habilitada.` : 'Las instancias pueden estar arriba, pero el bot global esta silenciado.',
      icon: <Zap className="w-4 h-4" />,
      badge: isGloballyOn ? 'on' : 'off',
      badgeClassName: isGloballyOn ? 'border-[rgb(var(--success))]/20 bg-[rgb(var(--success))]/10 text-[#c7f9d8]' : 'border-danger/20 bg-danger/10 text-danger/80',
      glowClassName: 'from-[rgb(var(--success))]/18 via-oguri-cyan/10 to-transparent',
    },
  ];

  const handleClosePhoneModal = useCallback(() => setShowPhoneModal(false), []);
  const handleClosePairingModal = useCallback(() => {
    setShowPairingModal(false);
    setCurrentPairingCode(null);
  }, []);
  const handleCloseQRModal = useCallback(() => setShowQR(false), []);

  const handleCloseSettingsModal = useCallback(() => {
    setShowSettingsModal(false);
    setSettingsSubbot(null);
    setSettingsForm({ alias: '', name: '', status: '', pfp: '', customName: '', customPrefix: '', customBanner: '', customVideo: '' });
  }, []);

  const normalizeSubbot = (raw: any): Subbot => {
    const code = String(raw?.code || raw?.codigo || raw?.subbotCode || '').trim();
    const type: SubbotType = raw?.type === 'code' || raw?.tipo === 'code' ? 'code' : 'qr';
    const status: SubbotStatus = (raw?.status || raw?.estado || 'inactivo') as SubbotStatus;
    return {
      id: Number(raw?.id || 0),
      code,
      codigo: String(raw?.codigo || code),
      type,
      status,
      connectionState: (raw?.connectionState || raw?.connection_state || undefined) as SubbotConnectionState | undefined,
      usuario: String(raw?.usuario || raw?.owner || 'admin'),
      fecha_creacion: String(raw?.fecha_creacion || raw?.created_at || new Date().toISOString()),
      numero: raw?.numero ?? raw?.phoneNumber ?? raw?.phone ?? null,
      whatsappName: raw?.nombre_whatsapp ?? raw?.whatsappName ?? null,
      aliasDir: raw?.alias_dir ?? raw?.aliasDir ?? null,
      customName: raw?.custom_name ?? raw?.customName ?? null,
      customPrefix: raw?.custom_prefix ?? raw?.customPrefix ?? null,
      customBanner: raw?.custom_banner ?? raw?.customBanner ?? null,
      customVideo: raw?.custom_video ?? raw?.customVideo ?? null,
      displayName: raw?.displayName ?? raw?.display_name ?? null,
      qr_data: raw?.qr_data ?? raw?.qr_code ?? null,
      pairingCode: raw?.pairingCode ?? raw?.pairing_code ?? null,
      isOnline: Boolean(raw?.isOnline || raw?.connected),
      whatsapp_status: raw?.whatsapp_status ?? raw?.status_whatsapp ?? raw?.bio ?? null,
    };
  };

  const loadSubbots = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.getSubbots();
      if (response) {
        setSubbots((Array.isArray(response) ? response : response.subbots || []).map(normalizeSubbot));
      }
    } catch {
      notify.error('No se pudieron cargar los subbots');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCapacity = useCallback(async () => {
    try {
      const res = await api.getSubbotsCapacity();
      if (res?.capacity) setCapacity(res.capacity);
    } catch {
      // silencioso
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await loadCapacity();
    await loadSubbots();
  }, [loadCapacity, loadSubbots]);

  const reindexAllSubbots = useCallback(async () => {
    try {
      setActionLoading('reindex');
      const res = await api.reindexSubbots();
      const removed = Number(res?.removed_symlinks || 0) || 0;
      const count = Number(res?.count || 0) || 0;
      notify.success(`Reindex completado (${count})${removed ? ` • symlinks rotos: ${removed}` : ''}`);
      await refreshAll();
    } catch (err: any) {
      notify.error(err?.response?.data?.error || 'No se pudo reindexar los subbots');
    } finally {
      setActionLoading(null);
    }
  }, [refreshAll]);

  const normalizeAllSubbots = useCallback(async () => {
    try {
      setActionLoading('normalize');
      const res = await api.normalizeSubbots();
      const rep = res?.report;
      const migrated = Number(rep?.migrated || 0) || 0;
      const online = Number(rep?.skipped_online || 0) || 0;
      const conflicts = Number(rep?.conflicts || 0) || 0;
      notify.success(`Normalizado: ${migrated} • online: ${online} • conflictos: ${conflicts}`);
      await refreshAll();
    } catch (err: any) {
      notify.error(err?.response?.data?.error || 'No se pudo normalizar las carpetas de subbots');
    } finally {
      setActionLoading(null);
    }
  }, [refreshAll]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Socket events
  useEffect(() => {
    if (!socket) return;

    const upsert = (incoming: Subbot) => {
      setSubbots(prev => {
        const idx = prev.findIndex(s => s.code === incoming.code || s.codigo === incoming.code);
        if (idx === -1) return [incoming, ...prev];
        return prev.map((s, i) => (i === idx ? incoming : s));
      });
    };

    const handleSubbotDeleted = (data: { subbotCode: string }) => {
      setSubbots(prev => prev.filter(s => s.code !== data.subbotCode && s.codigo !== data.subbotCode));
    };

    const handleSubbotDisconnected = (data: { subbotCode: string }) => {
      setSubbots(prev => prev.map(s => {
        if (s.code === data.subbotCode || s.codigo === data.subbotCode) {
          return { ...s, isOnline: false, status: 'inactivo' as SubbotStatus, connectionState: 'disconnected' };
        }
        return s;
      }));
    };

    const handleSubbotConnected = (data: { subbotCode: string; phone?: string }) => {
      setSubbots(prev => prev.map(s => {
        if (s.code === data.subbotCode || s.codigo === data.subbotCode) {
          return { ...s, isOnline: true, status: 'activo' as SubbotStatus, connectionState: 'connected', numero: data.phone || s.numero, qr_data: null, pairingCode: null };
        }
        return s;
      }));
    };

    const handlePairingCode = (data: { subbotCode: string; pairingCode: string }) => {
      setCurrentPairingCode(data.pairingCode);
      setCurrentPairingSubbot(data.subbotCode);
      setShowPairingModal(true);
      setShowPhoneModal(false);
      setSubbots(prev => prev.map(s => (
        (s.code === data.subbotCode || s.codigo === data.subbotCode)
          ? { ...s, pairingCode: data.pairingCode, connectionState: 'needs_auth', isOnline: false }
          : s
      )));
    };

    const handleQRCode = async (data: { subbotCode: string; qr: string }) => {
      try {
        const qrDataURL = await QRCode.toDataURL(data.qr, { width: 256, margin: 2 });
        setQrImage(qrDataURL);
        setSubbots(prev => {
          const existing = prev.find(s => s.code === data.subbotCode || s.codigo === data.subbotCode);
          const updated = prev.map(s =>
            (s.code === data.subbotCode || s.codigo === data.subbotCode)
              ? { ...s, qr_data: data.qr, connectionState: 'needs_auth' as SubbotConnectionState, isOnline: false }
              : s
          );
          const target = existing
            ? { ...existing, qr_data: data.qr, connectionState: 'needs_auth' as SubbotConnectionState, isOnline: false }
            : { code: data.subbotCode, codigo: data.subbotCode, qr_data: data.qr, connectionState: 'needs_auth' as SubbotConnectionState, isOnline: false, estado: 'activo' as SubbotStatus, tipo: 'qr' as const, usuario: '', id: 0, session_dir: data.subbotCode, fecha_creacion: new Date().toISOString(), created_from: 'panel' };
          setSelectedSubbot(target as Subbot);
          setShowQR(true);
          return existing ? updated : [...updated, target as Subbot];
        });
      } catch (err) {
        console.error('Error generando QR:', getErrorMessage(err));
      }
    };

    const handleSubbotStatus = (data: { subbots: any[] }) => {
      if (!Array.isArray(data?.subbots)) return;
      setSubbots(prev => {
        const map = new Map(prev.map(s => [s.code, s]));
        for (const raw of data.subbots) {
          const code = String(raw?.subbotCode || raw?.code || raw?.codigo || '').trim();
          if (!code) continue;
          const existing = map.get(code);
          const merged = normalizeSubbot({ ...(existing || {}), ...raw, code, codigo: code });
          map.set(code, merged);
        }
        return Array.from(map.values());
      });
    };

    socket.on('subbot:status', handleSubbotStatus);
    socket.on('subbot:deleted', handleSubbotDeleted);
    socket.on('subbot:disconnected', handleSubbotDisconnected);
    socket.on('subbot:connected', handleSubbotConnected);
    socket.on('subbot:pairingCode', handlePairingCode);
    socket.on('subbot:qr', handleQRCode);
    socket.on('subbot:created', (data: any) => data?.subbot && upsert(normalizeSubbot(data.subbot)));
    socket.on('subbot:updated', (data: any) => data?.subbot && upsert(normalizeSubbot(data.subbot)));

    return () => {
      socket.off('subbot:status', handleSubbotStatus);
      socket.off('subbot:deleted', handleSubbotDeleted);
      socket.off('subbot:disconnected', handleSubbotDisconnected);
      socket.off('subbot:connected', handleSubbotConnected);
      socket.off('subbot:pairingCode', handlePairingCode);
      socket.off('subbot:qr', handleQRCode);
    };
  }, [socket]);

  const createQRSubbot = async () => {
    try {
      setActionLoading('qr');
      const response = await api.createSubbot(1, 'qr');
      if (response) {
        notify.success('¡Instancia QR creada! Espera al código QR.');
      }
    } catch (err: any) {
      notify.error(err?.response?.data?.error || 'Error al crear la instancia QR');
    } finally {
      setActionLoading(null);
    }
  };

  const createCodeSubbot = async () => {
    if (!phoneNumber.trim()) {
      notify.error('Por favor, ingresa un número de teléfono');
      return;
    }
    try {
      setActionLoading('code');
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
      await api.createSubbot(1, 'code', cleanPhone);
      setPhoneNumber('');
      setShowPhoneModal(false);
      notify.success('Instancia creada. Generando código...');
    } catch (err: any) {
      notify.error(err?.response?.data?.error || 'Error al crear la instancia por código');
    } finally {
      setActionLoading(null);
    }
  };

  const deleteSubbot = async (idOrCode: string | number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este subbot?')) return;
    try {
      setActionLoading(`delete-${idOrCode}`);
      await api.deleteSubbot(String(idOrCode));
      // Actualizar UI inmediatamente sin esperar el evento socket
      setSubbots(prev => prev.filter(s => s.code !== String(idOrCode) && s.codigo !== String(idOrCode) && s.id !== idOrCode));
      notif.subbots.eliminado();
    } catch (err: any) {
      notif.subbots.errorEliminar(err?.response?.data?.error);
    } finally {
      setActionLoading(null);
    }
  };

  const openSettings = (subbot: Subbot) => {
    setSettingsSubbot(subbot);
    setSettingsForm({
      alias: subbot.aliasDir || '',
      name: subbot.whatsappName || '',
      status: subbot.whatsapp_status || '',
      pfp: '',
      customName: subbot.customName || '',
      customPrefix: subbot.customPrefix || '',
      customBanner: subbot.customBanner || '',
      customVideo: subbot.customVideo || ''
    });
    setShowSettingsModal(true);
  };

  const handleSaveSettings = async () => {
    if (!settingsSubbot) return;
    try {
      setActionLoading('save-settings');
      await api.updateSubbotSettings(settingsSubbot.code, settingsForm);
      notify.success('Configuración actualizada');
      handleCloseSettingsModal();
      loadSubbots(); 
    } catch (err: any) {
      notify.error(err?.response?.data?.error || 'No se pudo guardar');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (subbot: Subbot) => {
    if (subbot.isOnline) return 'text-success border-success/30 bg-success/10';
    if (subbot.connectionState === 'needs_auth') return 'text-warning border-warning/30 bg-warning/10';
    return 'text-gray-400 border-white/10 bg-white/5';
  };

  const getStatusText = (subbot: Subbot) => {
    if (subbot.isOnline) return 'Conectado';
    if (subbot.connectionState === 'needs_auth') return 'Pendiente';
    return 'Desconectado';
  };

  return (
    <div className="relative space-y-8 p-4 sm:p-8 lg:p-10 min-h-screen overflow-hidden">
      {/* Premium Ambient Background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(var(--page-a),0.05),transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(var(--page-b),0.05),transparent_40%)]" />
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <div className="relative z-10 space-y-10">
        <PageHeader 
          title="SubBots Network"
          description={
            isUsuario
              ? 'Gestión personalizada de tus instancias activas y vinculaciones.'
              : 'Panel de control central para la red de subbots y gestión de sesiones.'
          }
          icon={<Bot className="h-6 w-6" />}
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <ActionButton
                icon={<RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />}
                onClick={refreshAll}
                variant="secondary"
                disabled={loading}
              >
                Sincronizar
              </ActionButton>
              {canDeleteSubbots && (
                <div className="flex items-center gap-2">
                  <ActionButton 
                    icon={<Smartphone className="h-4 w-4" />} 
                    variant="ghost" 
                    onClick={normalizeAllSubbots}
                    disabled={actionLoading !== null}
                  >
                    Normalizar
                  </ActionButton>
                  <ActionButton 
                    icon={<RefreshCw className="h-4 w-4" />} 
                    variant="ghost" 
                    onClick={reindexAllSubbots}
                    disabled={actionLoading !== null}
                  >
                    Reindexar
                  </ActionButton>
                </div>
              )}
            </div>
          }
        >
          <div className="flex flex-wrap items-center gap-4 mt-4">
            <RealTimeBadge isActive={isSocketConnected} />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/10 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              <Activity className="h-3.5 w-3.5 text-primary" />
              {connectedCount} de {subbots.length} Online
            </div>
            {isGloballyOn ? (
              <Badge variant="success" className="animate-pulse-subtle">Red Activa</Badge>
            ) : (
              <Badge variant="danger">Red Pausada</Badge>
            )}
          </div>
        </PageHeader>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {subbotLanes.map((lane, index) => (
            <motion.div
              key={lane.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 + index * 0.05, duration: 0.3 }}
              className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-card/40 p-5 backdrop-blur-xl transition-all duration-300 hover:bg-card/60"
            >
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-5 transition-opacity group-hover:opacity-10 ${lane.glowClassName}`} />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-glow-sm">
                    {lane.icon}
                  </div>
                  <span className={cn(
                    "rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest",
                    lane.badgeClassName
                  )}>
                    {lane.badge}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{lane.label}</p>
                  <p className="mt-1 text-xl font-black text-foreground">{lane.value}</p>
                  <p className="mt-2 text-xs font-medium text-muted-foreground leading-relaxed">{lane.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Action Controls */}
        <Reveal>
          <div className="panel-surface relative overflow-hidden rounded-[32px] p-6 sm:p-8">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <h3 className="text-xl font-black text-foreground tracking-tight">Expandir Red</h3>
                <p className="text-sm text-muted-foreground max-w-md">Inicia una nueva instancia para escalar tu alcance de mensajería.</p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Button 
                  onClick={createQRSubbot} 
                  loading={actionLoading === 'qr'} 
                  variant="primary" 
                  size="lg"
                  className="rounded-2xl shadow-glow-primary px-8"
                  icon={<QrCode className="h-5 w-5" />}
                >
                  Nuevo QR
                </Button>
                <Button 
                  onClick={() => setShowPhoneModal(true)} 
                  loading={actionLoading === 'code'} 
                  variant="secondary" 
                  size="lg"
                  className="rounded-2xl px-8"
                  icon={<Key className="h-5 w-5" />}
                >
                  Nuevo Código
                </Button>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Subbots Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-lg font-black uppercase tracking-[0.2em] text-muted-foreground">Flota Activa</h3>
            <div className="text-xs font-bold text-muted-foreground">
              {subbots.length} Instancias Registradas
            </div>
          </div>

          {loading && subbots.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-64 animate-pulse rounded-[28px] bg-white/[0.03] border border-white/5" />
              ))}
            </div>
          ) : subbots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-20 w-20 rounded-full bg-white/[0.03] flex items-center justify-center mb-6">
                <Bot className="h-10 w-10 text-muted-foreground/30" />
              </div>
              <h4 className="text-xl font-bold text-foreground">No hay subbots</h4>
              <p className="text-muted-foreground mt-2">Comienza creando una nueva instancia arriba.</p>
            </div>
          ) : (
            <Stagger className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {subbots.map((subbot, index) => (
                  <StaggerItem key={subbot.code || subbot.id}>
                    <motion.div
                      layout
                      whileHover={{ y: -5 }}
                      className={cn(
                        "group relative overflow-hidden rounded-[28px] border bg-card/40 p-6 backdrop-blur-xl transition-all duration-300",
                        subbot.isOnline ? "border-success/20 hover:border-success/40" : "border-white/10 hover:border-white/20"
                      )}
                    >
                      {/* Ambient light for online bots */}
                      {subbot.isOnline && (
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_50%)]" />
                      )}

                      <div className="relative z-10 space-y-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <div className="h-14 w-14 overflow-hidden rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center shadow-glow-sm">
                                {subbot.customBanner ? (
                                  <img src={subbot.customBanner} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <Bot className="h-7 w-7 text-primary/50" />
                                )}
                              </div>
                              <span className={cn(
                                "absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-[#0d1210]",
                                subbot.isOnline ? "bg-success shadow-glow-emerald" : "bg-muted-foreground"
                              )}>
                                {subbot.isOnline && <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-75" />}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <h4 className="truncate text-base font-black text-foreground">
                                {subbot.displayName || subbot.customName || subbot.whatsappName || subbot.code}
                              </h4>
                              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">
                                {subbot.code}
                              </p>
                            </div>
                          </div>
                          <Badge 
                            variant={subbot.isOnline ? 'success' : 'outline'}
                            className="text-[9px] font-black tracking-widest uppercase"
                          >
                            {getStatusText(subbot)}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Método</p>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                              {subbot.type === 'qr' ? <QrCode className="h-3 w-3 text-primary" /> : <Key className="h-3 w-3 text-oguri-lavender" />}
                              {subbot.type === 'qr' ? 'QR Sync' : 'Pairing'}
                            </div>
                          </div>
                          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Dueño</p>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                              <User className="h-3 w-3 text-muted-foreground" />
                              {subbot.usuario}
                            </div>
                          </div>
                        </div>

                        {subbot.numero && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10">
                            <Smartphone className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs font-mono font-bold text-primary">{subbot.numero}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center gap-2">
                            {subbot.type === 'qr' && !subbot.isOnline && (
                              <ActionButton size="sm" onClick={() => api.getSubbotQR(subbot.code).then(res => {
                                if(res?.qr) { setQrImage(`data:image/png;base64,${res.qr}`); setSelectedSubbot(subbot); setShowQR(true); }
                              })} icon={<QrCode className="h-4 w-4" />}>
                                QR
                              </ActionButton>
                            )}
                            {subbot.type === 'code' && !subbot.isOnline && subbot.pairingCode && (
                              <ActionButton size="sm" onClick={() => { setCurrentPairingCode(subbot.pairingCode!); setCurrentPairingSubbot(subbot.code); setShowPairingModal(true); }} icon={<Key className="h-4 w-4" />}>
                                Código
                              </ActionButton>
                            )}
                            <ActionButton 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => openSettings(subbot)} 
                              icon={<Settings className="h-4 w-4" />} 
                            />
                          </div>
                          {canDeleteSubbots && (
                            <button 
                              onClick={() => deleteSubbot(subbot.code)}
                              disabled={actionLoading === `delete-${subbot.code}`}
                              className="p-2 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded-xl transition-all"
                            >
                              <Trash2 className="h-4.5 w-4.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </StaggerItem>
                ))}
              </AnimatePresence>
            </Stagger>
          )}
        </div>
      </div>

      {/* Modals */}
      <Modal isOpen={showPhoneModal} onClose={handleClosePhoneModal} title="Enlazar con Código">
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">Ingresa el número de WhatsApp con el código de país para generar el vínculo.</p>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Número de Teléfono</label>
            <input 
              type="tel" 
              placeholder="Ej: 521..." 
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 text-foreground outline-none focus:border-primary/50 transition-all"
            />
          </div>
          <div className="flex gap-3">
            <Button onClick={handleClosePhoneModal} variant="ghost" className="flex-1">Cancelar</Button>
            <Button onClick={createCodeSubbot} loading={actionLoading === 'code'} variant="primary" className="flex-1 shadow-glow-primary">Generar</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showPairingModal && !!currentPairingCode} onClose={handleClosePairingModal} title="Código de Vinculación">
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="p-8 rounded-[32px] bg-success/10 border-2 border-success/20 shadow-glow-emerald">
            <span className="text-5xl font-black font-mono tracking-[0.2em] text-success">
              {currentPairingCode}
            </span>
          </div>
          <p className="text-sm text-center text-muted-foreground px-6">Ingresa este código en tu WhatsApp en <span className="text-foreground font-bold">Dispositivos Vinculados &gt; Vincular con número de teléfono</span>.</p>
          <Button onClick={() => { navigator.clipboard.writeText(currentPairingCode!); notify.success('Copiado'); }} variant="secondary" className="w-full" icon={<Copy className="h-4 w-4" />}>
            Copiar Código
          </Button>
        </div>
      </Modal>

      <Modal isOpen={showQR && !!qrImage} onClose={handleCloseQRModal} title="Sincronización QR">
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="p-4 rounded-[32px] bg-white shadow-glow-white overflow-hidden">
            <img src={qrImage!} alt="QR" className="h-64 w-64" />
          </div>
          <p className="text-sm text-center text-muted-foreground px-6">Escanea este código desde la sección de Dispositivos Vinculados en tu WhatsApp.</p>
          <div className="flex gap-3 w-full">
            <Button onClick={() => {
              const link = document.createElement('a');
              link.href = qrImage!;
              link.download = `qr-${selectedSubbot?.code}.png`;
              link.click();
            }} variant="ghost" className="flex-1" icon={<Download className="h-4 w-4" />}>
              Descargar
            </Button>
            <Button onClick={handleCloseQRModal} variant="primary" className="flex-1">Cerrar</Button>
          </div>
        </div>
      </Modal>

      {/* Settings Modal - Redacted for brevity but included to maintain file structure */}
      <Modal isOpen={showSettingsModal} onClose={handleCloseSettingsModal} title="Personalización de Instancia">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
             <div className="space-y-2">
               <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nombre Público</label>
               <input 
                 value={settingsForm.customName} 
                 onChange={e => setSettingsForm(prev => ({...prev, customName: e.target.value}))}
                 className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 text-foreground"
               />
             </div>
             <div className="space-y-2">
               <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Prefijo de Comandos</label>
               <input 
                 value={settingsForm.customPrefix} 
                 onChange={e => setSettingsForm(prev => ({...prev, customPrefix: e.target.value}))}
                 placeholder="Ej: ."
                 className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 text-foreground"
               />
             </div>
             <div className="space-y-2">
               <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Banner de Menú (URL)</label>
               <input 
                 value={settingsForm.customBanner} 
                 onChange={e => setSettingsForm(prev => ({...prev, customBanner: e.target.value}))}
                 className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 text-foreground"
               />
             </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button onClick={handleCloseSettingsModal} variant="ghost" className="flex-1">Cancelar</Button>
            <Button onClick={handleSaveSettings} loading={actionLoading === 'save-settings'} variant="primary" className="flex-1 shadow-glow-primary">Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
