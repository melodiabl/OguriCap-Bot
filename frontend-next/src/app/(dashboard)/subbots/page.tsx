'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  QrCode, Key, Trash2, RefreshCw, Wifi, WifiOff, Bot, AlertCircle,
  Download, Copy, Zap, Radio, Clock, Smartphone, CheckCircle, XCircle,
  Settings, User, Image as ImageIcon, MessageSquare
} from 'lucide-react';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Reveal } from '@/components/motion/Reveal';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { useSocketConnection } from '@/contexts/SocketContext';
import { useBotGlobalState } from '@/contexts/BotGlobalStateContext';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { notify } from '@/lib/notify';
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
  const phoneInputRef = React.useRef<HTMLInputElement>(null);
  const canDeleteSubbots = !!user && ['owner', 'admin', 'administrador'].includes(String(user.rol || '').toLowerCase());
  const isUsuario = !!user && String(user.rol || '').toLowerCase() === 'usuario';

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

  const handlePfpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      notify.error('La imagen debe ser menor a 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSettingsForm(prev => ({ ...prev, pfp: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async () => {
    if (!settingsSubbot) return;

    try {
      setActionLoading('save-settings');
      await api.updateSubbotSettings(settingsSubbot.code, settingsForm);
      notify.success(`Configuración de "${settingsForm.alias || settingsSubbot.code}" actualizada`);
      handleCloseSettingsModal();
      loadSubbots(); 
    } catch (err: any) {
      notify.error(err?.response?.data?.error || 'No se pudo guardar la configuración');
    } finally {
      setActionLoading(null);
    }
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
    try {
      await loadCapacity();
    } catch {}
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

  // Fallback sin intervalos (solo cuando no hay Socket.IO)
  useEffect(() => {
    if (isSocketConnected) return;
    
    const onFocus = () => {
      if (!loading) loadSubbots();
    };

    const onOnline = () => {
      if (!loading) loadSubbots();
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [isSocketConnected, loading, loadSubbots]);

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
      // Usamos una referencia o el estado actual de forma segura si es necesario, 
      // pero aquí dependemos de flags que pueden cambiar.
      setPendingPairingSubbotCode(null);
      setCurrentPairingCode(data.pairingCode);
      setCurrentPairingSubbot(data.subbotCode);
      setShowPairingModal(true);
      setShowPhoneModal(false);
      setSubbots(prev => prev.map(s => (
        (s.code === data.subbotCode || s.codigo === data.subbotCode)
          ? { ...s, pairingCode: data.pairingCode, connectionState: 'needs_auth', isOnline: false }
          : s
      )));
      loadSubbots();
    };

    const handleQRCode = async (data: { subbotCode: string; qr: string }) => {
      try {
        const qrDataURL = await QRCode.toDataURL(data.qr, { width: 256, margin: 2 });
        setQrImage(qrDataURL);
        // Nota: setSelectedSubbot y setShowQR se manejan mejor con el estado actual de subbots
        // pero para simplificar lo mantenemos así, asegurando estabilidad de subbots en deps.
        setSubbots(prev => {
          const subbot = prev.find(s => s.code === data.subbotCode);
          if (subbot) {
            setSelectedSubbot(subbot);
            setShowQR(true);
          }
          return prev.map(s => (
            (s.code === data.subbotCode || s.codigo === data.subbotCode)
              ? { ...s, qr_data: data.qr, connectionState: 'needs_auth', isOnline: false }
              : s
          ));
        });
      } catch (err) {
        console.error('Error generando QR:', err);
      }
      loadSubbots();
    };

    const handleSubbotUpdated = (data: { subbot: any }) => {
      if (!data?.subbot) return;
      const updatedSubbot = normalizeSubbot(data.subbot);
      upsert(updatedSubbot);
    };

    const handleSubbotCreated = (data: { subbot: any }) => {
      if (!data?.subbot) return;
      const created = normalizeSubbot(data.subbot);
      upsert(created);
    };

    socket.on('subbot:deleted', handleSubbotDeleted);
    socket.on('subbot:disconnected', handleSubbotDisconnected);
    socket.on('subbot:connected', handleSubbotConnected);
    socket.on('subbot:pairingCode', handlePairingCode);
    socket.on('subbot:qr', handleQRCode);
    socket.on('subbot:created', handleSubbotCreated);
    socket.on('subbot:updated', handleSubbotUpdated);

    return () => {
      socket.off('subbot:deleted', handleSubbotDeleted);
      socket.off('subbot:disconnected', handleSubbotDisconnected);
      socket.off('subbot:connected', handleSubbotConnected);
      socket.off('subbot:pairingCode', handlePairingCode);
      socket.off('subbot:qr', handleQRCode);
      socket.off('subbot:created', handleSubbotCreated);
      socket.off('subbot:updated', handleSubbotUpdated);
    };
  }, [socket, loadSubbots]); // Removido subbots, pendingPairingSubbotCode y showPhoneModal para estabilidad


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
	      numero: raw?.numero ?? raw?.phoneNumber ?? null,
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

  useEffect(() => {
    loadSubbots();
    loadCapacity();
  }, [loadSubbots, loadCapacity]);

  const getSubbotStatus = async () => {
	    try {
	      const data = await api.getSubbotStatus();
	      if (data) {
	        setSubbots(prev => prev.map(subbot => {
	          const status = data.subbots?.find((s: any) => s.subbotId === subbot.code || s.code === subbot.code);
	          return {
	            ...subbot,
	            isOnline: status?.isOnline || status?.connected || false,
	            status: (status?.status || subbot.status) as SubbotStatus,
	            connectionState: (status?.connectionState || subbot.connectionState) as SubbotConnectionState | undefined,
	          };
	        }));
	      }
	    } catch (err) {
	      console.error('Error obteniendo estado de subbots:', err);
	    }
	  };

  const createQRSubbot = async () => {
    try {
      setActionLoading('qr');
      setPendingPairingSubbotCode(null);
      const response = await api.createSubbot(1, 'qr');
      if (response) {
        const newSubbot = normalizeSubbot(response);
        setSubbots(prev => [newSubbot, ...prev]);
        notify.success('¡Instancia QR creada! Escanea el código que aparecerá abajo.');
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
      const response = await api.createSubbot(1, 'code', cleanPhone);
      if (response) {
        const newSubbot = normalizeSubbot(response);
        setSubbots(prev => [newSubbot, ...prev]);
        if (response.pairingCode || response.pairing_code) {
          setPendingPairingSubbotCode(null);
          setCurrentPairingCode(response.pairingCode || response.pairing_code);
          setCurrentPairingSubbot(newSubbot.code);
          setShowPairingModal(true);
          setShowPhoneModal(false);
          notify.success('Código de vinculación generado con éxito');
        } else {
          setPendingPairingSubbotCode(newSubbot.code);
          notify.success('Instancia creada. Generando código de vinculación...');
        }
        setPhoneNumber('');
      }
    } catch (err: any) {
      notify.error(err?.response?.data?.error || 'Error al crear la instancia por código');
    } finally {
      setActionLoading(null);
    }
  };

  const deleteSubbot = async (idOrCode: string | number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este subbot?')) return;
    try {
      const key = String(idOrCode);
      setActionLoading(`delete-${key}`);
      await api.deleteSubbot(key);
      setSubbots(prev => prev.filter(s => String(s.id) !== key && s.code !== key && s.codigo !== key));
      notify.success('Subbot eliminado correctamente');
    } catch (err: any) {
      notify.error(err?.response?.data?.error || 'Error al eliminar subbot');
    } finally {
      setActionLoading(null);
    }
  };

  const viewQR = async (subbot: Subbot) => {
    try {
      if (subbot.qr_data) {
        const qrDataURL = await QRCode.toDataURL(subbot.qr_data, { width: 256, margin: 2 });
        setQrImage(qrDataURL);
        setSelectedSubbot(subbot);
        setShowQR(true);
      } else {
        const response = await api.getSubbotQR(subbot.code);
        if (response?.qr) {
          setQrImage(`data:image/png;base64,${response.qr}`);
          setSelectedSubbot(subbot);
          setShowQR(true);
    } else {
      notify.error('QR no disponible para este subbot');
    }
  }
} catch {
  notify.error('Error obteniendo QR');
}
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    notify.success('Copiado al portapapeles');
  };

  const getStatusColor = (subbot: Subbot) => {
    if (subbot.isOnline) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (subbot.connectionState === 'needs_auth') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    const isPendingLegacy = Boolean(!subbot.connectionState && (subbot.qr_data || subbot.pairingCode));
    if (isPendingLegacy) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    if (subbot.status === 'error') return 'bg-red-500/20 text-red-400 border-red-500/30';
    return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const getStatusText = (subbot: Subbot) => {
    if (subbot.isOnline) return 'Conectado';
    if (subbot.connectionState === 'needs_auth') return subbot.type === 'code' ? 'Esperando pairing' : 'Esperando QR';
    const isPendingLegacy = Boolean(!subbot.connectionState && (subbot.qr_data || subbot.pairingCode));
    if (isPendingLegacy) return subbot.type === 'code' ? 'Esperando pairing' : 'Esperando QR';
    if (subbot.connectionState === 'missing_session') return 'Inactivo (sin sesión)';
    if (subbot.connectionState === 'disconnected') return 'Inactivo';
    if (subbot.status === 'error') return 'Error';
    return 'Inactivo';
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString('es-ES');

  return (
    <div className="panel-page relative overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[-8%] top-[-4rem] -z-10 h-[420px] overflow-hidden">
        <div className="module-atmosphere" />
        <motion.div
          className="absolute left-[10%] top-[10%] h-52 w-52 rounded-full bg-oguri-gold/18 blur-3xl"
          animate={{ x: [0, 16, 0], y: [0, 14, 0], opacity: [0.18, 0.36, 0.18] }}
          transition={{ repeat: Infinity, duration: 10.6, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-[10%] top-[14%] h-56 w-56 rounded-full bg-oguri-blue/18 blur-3xl"
          animate={{ x: [0, -20, 0], y: [0, 18, 0], opacity: [0.18, 0.4, 0.18] }}
          transition={{ repeat: Infinity, duration: 11.2, ease: 'easeInOut', delay: 0.4 }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-6 overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(var(--page-a),0.18),rgba(var(--page-b),0.10),rgba(var(--page-c),0.12))] p-5 shadow-[0_28px_90px_-44px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-6"
      >
        <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="relative z-10 grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="panel-live-pill mb-3 w-fit">
              <Bot className="h-3.5 w-3.5 text-oguri-cyan" />
              Hangar multicuenta
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Subbots con look operativo futurista</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-gray-300">
              Gestión visual de flotas, autenticación QR/pairing y estado vivo de cada instancia con ambiente propio.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Flota</p>
              <p className="mt-2 text-lg font-black text-white">{subbots.length}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Online</p>
              <p className="mt-2 text-lg font-black text-white">{subbots.filter(s => s.isOnline).length}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Canal</p>
              <p className="mt-2 text-lg font-black text-white">{isSocketConnected ? 'LIVE' : 'LOCAL'}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Header */}
      <PageHeader
        title={isUsuario ? 'Mis SubBots' : 'Gestión de Subbots'}
        description={
          isUsuario
            ? 'Crea y revisa tus subbots (solo tú y admins/owner pueden verlos)'
            : 'Crea y gestiona subbots para conectar múltiples cuentas de WhatsApp'
        }
        icon={<Bot className="w-5 h-5 text-blue-400" />}
        actions={
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
              isSocketConnected
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}
          >
            <Radio className={`w-3 h-3 ${isSocketConnected ? 'animate-pulse' : ''}`} />
            {isSocketConnected ? 'Tiempo Real' : 'Sin conexión'}
          </div>
        }
      />

      {/* Stats */}
      <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" delay={0.02} stagger={0.07}>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <StatCard
            title="Total Subbots"
            value={subbots.length}
            subtitle={`${subbots.filter(s => s.type === 'qr').length} QR • ${subbots.filter(s => s.type === 'code').length} Códigos`}
            icon={<Bot className="w-6 h-6" />}
            color="info"
            delay={0}
            animated={false}
          />
        </StaggerItem>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <StatCard title="Conectados" value={subbots.filter(s => s.isOnline).length} subtitle="Activos ahora" icon={<Wifi className="w-6 h-6" />} color="success" delay={0} animated={false} />
        </StaggerItem>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <StatCard
            title="Esperando"
            value={subbots.filter(s => !s.isOnline && (s.connectionState === 'needs_auth' || (!s.connectionState && (s.qr_data || s.pairingCode)))).length}
            subtitle="Por conectar"
            icon={<Clock className="w-6 h-6" />}
            color="warning"
            delay={0}
            animated={false}
          />
        </StaggerItem>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <StatCard
            title="Tiempo Real"
            value={isSocketConnected ? 'Activo' : 'Inactivo'}
            subtitle="Socket.IO"
            icon={<Zap className="w-6 h-6" />}
            color={isSocketConnected ? 'success' : 'danger'}
            delay={0}
            animated={false}
          />
        </StaggerItem>
      </Stagger>

      {/* Create Subbot */}
      <Reveal>
        <Card animated delay={0.2} className="p-5 sm:p-6 shadow-glow-oguri-blue">
          <div className="panel-card-heading mb-5">
            <div className="panel-card-icon"><Bot className="w-5 h-5" /></div>
            <div>
              <h2 className="panel-card-title">Crear Nuevo Subbot</h2>
              <p className="panel-card-description">Elige QR o pairing code para vincular otra cuenta de WhatsApp.</p>
            </div>
          </div>
          {capacity && (
            <div className="panel-note-card mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[rgb(var(--text-secondary))]">
              <span><span className="text-muted">Capacidad:</span> {capacity.effectiveMax}</span>
              <span><span className="text-muted">Disponibles:</span> {capacity.remaining}</span>
              <span><span className="text-muted">Recomendado:</span> {capacity.recommendedMax}</span>
              <span><span className="text-muted">Auto:</span> {capacity.autoLimit ? 'Si' : 'No'}</span>
            </div>
          )}
          <div className="panel-actions-wrap">
            <Button onClick={createQRSubbot} loading={actionLoading === 'qr'} variant="primary" icon={<QrCode className="w-5 h-5" />}>
              Crear QR Subbot
            </Button>
            <Button onClick={() => { setPendingPairingSubbotCode(null); setShowPhoneModal(true); }} loading={actionLoading === 'code'} variant="success" icon={<Key className="w-5 h-5" />}>
              Crear CODE Subbot
            </Button>
          </div>
          <div className="panel-note-card mt-4 space-y-2 text-sm text-muted">
            <p>
            • <strong className="text-[rgb(var(--text-primary))]">QR Subbot:</strong> Escanea el código QR con WhatsApp<br />
            • <strong className="text-[rgb(var(--text-primary))]">CODE Subbot:</strong> Usa el código de emparejamiento
            </p>
          {isSocketConnected && (
            <p className="text-sm text-emerald-400 mt-2 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Los códigos QR y de pairing aparecerán automáticamente en tiempo real
            </p>
          )}
          </div>
        </Card>
      </Reveal>

      {/* Subbots List */}
      <Card animated delay={0.3} className="overflow-hidden shadow-glow-oguri-mixed">
        <div className="flex flex-col gap-4 border-b border-border/15 p-5 text-center sm:p-6 sm:text-left xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Subbots Activos</h2>
            <p className="mt-1 text-muted">
              <AnimatedNumber value={subbots.length} /> subbot{subbots.length !== 1 ? 's' : ''} configurado{subbots.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="panel-actions-wrap shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshAll}
              disabled={loading}
              icon={<RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />}
            >
              Refrescar
            </Button>
            {canDeleteSubbots && (
              <Button
                variant="secondary"
                size="sm"
                onClick={normalizeAllSubbots}
                loading={actionLoading === 'normalize'}
                icon={<Smartphone className="w-4 h-4" />}
                title="Renombra carpetas reales a pushname (solo offline)"
              >
                Normalizar
              </Button>
              )}
            {canDeleteSubbots && (
              <Button
                variant="secondary"
                size="sm"
                onClick={reindexAllSubbots}
                loading={actionLoading === 'reindex'}
                icon={<RefreshCw className="w-4 h-4" />}
                title="Reescanea Sessions/SubBot y repara symlinks rotos"
              >
                Reindexar
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
            <p className="text-muted">Cargando subbots...</p>
          </div>
        ) : subbots.length === 0 ? (
            <div className="p-8 text-center">
            <Bot className="mx-auto mb-4 h-16 w-16 text-muted" />
            <h3 className="mb-2 text-lg font-medium text-foreground">No hay subbots</h3>
            <p className="text-muted">Crea tu primer subbot para comenzar</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 xl:grid-cols-2 2xl:grid-cols-3">
            {subbots.map((subbot, index) => (
              <motion.div key={subbot.id || subbot.code} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }} className="panel-surface-soft panel-terminal-row p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-border/15 bg-card/60">
                      {subbot.customBanner ? (
                        <img src={subbot.customBanner} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Bot className="w-5 h-5 text-muted" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {subbot.displayName || subbot.customName || subbot.whatsappName || subbot.numero || subbot.code}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted">{subbot.code}</p>
                    </div>
                  </div>
                  <span className={`badge ${getStatusColor(subbot)}`}>{getStatusText(subbot)}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={`badge ${subbot.type === 'qr' ? 'badge-info' : 'badge-success'}`}>
                    {subbot.type === 'qr' ? <QrCode className="w-3 h-3" /> : <Key className="w-3 h-3" />}
                    {subbot.type === 'qr' ? 'QR Code' : 'Pairing Code'}
                  </span>
                  <span className="badge badge-info">
                    {subbot.isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    {subbot.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="panel-data-row">
                    <span className="panel-data-row__label">Numero</span>
                    <span className="panel-data-row__value">{subbot.numero || 'Sin numero'}</span>
                  </div>
                  <div className="panel-data-row">
                    <span className="panel-data-row__label">Usuario</span>
                    <span className="panel-data-row__value">{subbot.usuario}</span>
                  </div>
                  <div className="panel-data-row">
                    <span className="panel-data-row__label">Creado</span>
                    <span className="panel-data-row__value">{formatDate(subbot.fecha_creacion)}</span>
                  </div>
                </div>

                <div className="panel-actions-wrap mt-4 border-t border-border/15 pt-4">
                  {subbot.type === 'qr' && !subbot.isOnline && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => viewQR(subbot)}
                      icon={<QrCode className="w-4 h-4" />}
                    >
                      Ver QR
                    </Button>
                  )}
                  {subbot.type === 'code' && !subbot.isOnline && (
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => {
                        if (subbot.pairingCode) {
                          setCurrentPairingCode(subbot.pairingCode);
                          setCurrentPairingSubbot(subbot.code);
                          setShowPairingModal(true);
                        } else {
                          notify.warning('Generando código... espera un momento');
                        }
                      }}
                      icon={<Key className="w-4 h-4" />}
                    >
                      Ver Código
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openSettings(subbot)}
                    title="Configuración"
                    className="h-9 w-9 text-muted hover:text-foreground"
                    icon={<Settings className="w-4 h-4" />}
                  />
                  {canDeleteSubbots && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteSubbot(subbot.code)}
                      disabled={actionLoading === `delete-${subbot.code}`}
                      title="Eliminar"
                      className="h-9 w-9 text-muted hover:text-red-400"
                      loading={actionLoading === `delete-${subbot.code}`}
                      icon={<Trash2 className="w-4 h-4" />}
                    />
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      {/* Phone Modal */}
      <Modal isOpen={showPhoneModal} onClose={handleClosePhoneModal} title="Crear Subbot con Código">
        <div className="space-y-5">
          <p className="panel-field-hint">
            Ingresa el número de WhatsApp (con código de país) para generar el código de emparejamiento.
          </p>
          <div className="panel-field">
            <label className="panel-field-label">Número de WhatsApp</label>
          <input type="tel" placeholder="Ejemplo: 01231313" value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="input-glass w-full"
            data-autofocus />
          </div>
        {isSocketConnected && (
            <p className="text-sm text-emerald-400 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            El código aparecerá automáticamente
          </p>
        )}
          <div className="panel-modal-actions">
          <Button onClick={handleClosePhoneModal} variant="secondary" className="flex-1">Cancelar</Button>
          <Button onClick={createCodeSubbot} loading={actionLoading === 'code'} disabled={!phoneNumber.trim()} variant="success" className="flex-1">
            Crear Subbot
          </Button>
          </div>
        </div>
      </Modal>

      {/* Pairing Code Modal */}
      <Modal isOpen={showPairingModal && !!currentPairingCode} onClose={handleClosePairingModal} className="text-center">
        <div className="panel-stack-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center">
          <Key className="w-8 h-8 text-emerald-400" />
        </div>
        <h3 className="text-xl font-semibold text-foreground">¡Código de Pairing Generado!</h3>
        <p className="text-sm text-muted">Ingresa este código en WhatsApp para vincular el subbot</p>
        <div className="bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-xl p-6 border border-emerald-500/30 w-full">
          <motion.code initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-4xl font-mono font-bold text-emerald-400 tracking-wider">
            {currentPairingCode}
          </motion.code>
        </div>
        <p className="text-xs text-muted">Subbot: <code className="text-[rgb(var(--text-secondary))]">{currentPairingSubbot}</code></p>
        <div className="panel-modal-actions w-full">
          <Button onClick={() => copyToClipboard(currentPairingCode!)} variant="success" className="flex-1" icon={<Copy className="w-4 h-4" />}>
            Copiar Código
          </Button>
          <Button onClick={handleClosePairingModal} variant="secondary" className="flex-1">
            Cerrar
          </Button>
        </div>
        </div>
      </Modal>

      {/* QR Modal */}
      <Modal isOpen={showQR && !!selectedSubbot && !!qrImage} onClose={handleCloseQRModal} className="text-center">
        <div className="panel-stack-center space-y-4">
          <h3 className="text-xl font-semibold text-foreground">Código QR del Subbot</h3>
          {qrImage && <img src={qrImage} alt="QR Code" className="mx-auto rounded-xl bg-white p-2" decoding="async" />}
          <p className="text-sm text-muted">Escanea este código con WhatsApp para conectar el subbot</p>
        <div className="panel-modal-actions w-full justify-center">
          <Button onClick={() => {
            if (qrImage && selectedSubbot) {
              const link = document.createElement('a');
              link.href = qrImage;
              link.download = `subbot-qr-${selectedSubbot.code}.png`;
              link.click();
            }
          }} variant="primary" icon={<Download className="w-4 h-4" />}>
            Descargar
          </Button>
          <Button onClick={() => selectedSubbot?.qr_data && copyToClipboard(selectedSubbot.qr_data)} variant="secondary" icon={<Copy className="w-4 h-4" />}>
            Copiar Datos
          </Button>
        </div>
        </div>
      </Modal>

      {/* Settings Modal */}
      <Modal isOpen={showSettingsModal} onClose={handleCloseSettingsModal} title="Configuración de Subbot">
        <div className="space-y-5">
          <div className="panel-readonly-block">
            <div className="mb-2 text-xs text-muted">Identidad del SubBot (Menu)</div>
            <div className="panel-form-grid gap-3">
              <div className="panel-field">
                <label className="panel-field-label">Nombre (menu)</label>
                <input
                  type="text"
                  placeholder="Ej: Shadow SubBot"
                  value={settingsForm.customName}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, customName: e.target.value }))}
                  className="input-glass w-full"
                />
              </div>
              <div className="panel-field">
                <label className="panel-field-label">Prefijo</label>
                <input
                  type="text"
                  placeholder="Ej: .  |  !  |  multi"
                  value={settingsForm.customPrefix}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, customPrefix: e.target.value }))}
                  className="input-glass w-full"
                />
                <p className="panel-field-hint">Usa &quot;multi&quot; para varios prefijos</p>
              </div>
              <div className="panel-field md:col-span-2">
                <label className="panel-field-label">Banner URL (miniatura)</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={settingsForm.customBanner}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, customBanner: e.target.value }))}
                  className="input-glass w-full"
                />
                {settingsForm.customBanner ? (
                  <div className="mt-2 h-28 w-full overflow-hidden rounded-xl border border-border/15 bg-card/55">
                    <img src={settingsForm.customBanner} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : null}
              </div>
              <div className="panel-field md:col-span-2">
                <label className="panel-field-label">Video URL (opcional)</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={settingsForm.customVideo}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, customVideo: e.target.value }))}
                  className="input-glass w-full"
                />
              </div>
            </div>
            <div className="panel-field-hint mt-2">
              Esto actualiza lo que ves en el menu del SubBot. Si el SubBot esta online, se aplica al instante.
            </div>
          </div>

          <div className="panel-field">
            <label className="panel-field-label flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-400" /> Alias Local (Solo Panel)
            </label>
            <input
              type="text"
              placeholder="Ej: Bot Ventas 1"
              value={settingsForm.alias}
              onChange={(e) => setSettingsForm(prev => ({ ...prev, alias: e.target.value }))}
              className="input-glass w-full"
            />
          </div>

          <div className="panel-field">
            <label className="panel-field-label flex items-center gap-2">
              <User className="w-4 h-4 text-blue-400" /> Nombre de Perfil (WhatsApp)
            </label>
            <input
              type="text"
              placeholder="Nombre visible en WhatsApp"
              value={settingsForm.name}
              onChange={(e) => setSettingsForm(prev => ({ ...prev, name: e.target.value }))}
              className="input-glass w-full"
            />
            {!settingsSubbot?.isOnline && (
              <p className="panel-field-hint text-amber-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Requiere que el bot esté conectado para sincronizar con WhatsApp
              </p>
            )}
          </div>

          <div className="panel-field">
            <label className="panel-field-label flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-400" /> Bio / Estado (WhatsApp)
            </label>
            <textarea
              placeholder="Estado de WhatsApp..."
              value={settingsForm.status}
              onChange={(e) => setSettingsForm(prev => ({ ...prev, status: e.target.value }))}
              className="input-glass h-20 w-full resize-none"
            />
          </div>

          <div className="panel-field">
            <label className="panel-field-label flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-blue-400" /> Foto de Perfil (WhatsApp)
            </label>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/20 bg-card/60">
                {settingsForm.pfp ? (
                  <img src={settingsForm.pfp} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-muted" />
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePfpChange}
                  className="hidden"
                  id="pfp-upload"
                  disabled={!settingsSubbot?.isOnline}
                />
                <label
                  htmlFor="pfp-upload"
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    !settingsSubbot?.isOnline 
                      ? 'cursor-not-allowed bg-gray-500/10 text-gray-500' 
                      : 'bg-card/75 text-foreground hover:bg-card/90 border border-border/15'
                   }`}
                >
                  <Download className="w-3 h-3" /> Seleccionar Imagen
                </label>
                <p className="panel-field-hint mt-1">Máx: 2MB. Recomendado: 640x640px</p>
              </div>
            </div>
            {!settingsSubbot?.isOnline && (
              <p className="panel-field-hint text-amber-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Debes estar conectado para cambiar la foto
              </p>
            )}
          </div>

          <div className="panel-modal-actions">
            <Button onClick={handleCloseSettingsModal} variant="secondary" className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={handleSaveSettings}
              loading={actionLoading === 'save-settings'}
              variant="primary"
              className="flex-1"
              disabled={actionLoading === 'save-settings'}
            >
              Guardar Cambios
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
