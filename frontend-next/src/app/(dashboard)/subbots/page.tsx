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
import toast from 'react-hot-toast';
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
  
  // Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsSubbot, setSettingsSubbot] = useState<Subbot | null>(null);
  const [settingsForm, setSettingsForm] = useState({
    alias: '',
    name: '',
    status: '',
    pfp: ''
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
    setSettingsForm({ alias: '', name: '', status: '', pfp: '' });
  }, []);

  const openSettings = (subbot: Subbot) => {
    setSettingsSubbot(subbot);
    setSettingsForm({
      alias: subbot.aliasDir || '',
      name: subbot.whatsappName || '',
      status: subbot.whatsapp_status || '',
      pfp: ''
    });
    setShowSettingsModal(true);
  };

  const handlePfpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen debe ser menor a 2MB');
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
      toast.success(`Configuración de "${settingsForm.alias || settingsSubbot.code}" actualizada`);
      handleCloseSettingsModal();
      loadSubbots(); 
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'No se pudo guardar la configuración');
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
      toast.error('No se pudieron cargar los subbots');
    } finally {
      setLoading(false);
    }
  }, []);

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
      setSubbots(prev => prev.map(s => (s.code === updatedSubbot.code || s.codigo === updatedSubbot.code) ? updatedSubbot : s));
    };

    socket.on('subbot:deleted', handleSubbotDeleted);
    socket.on('subbot:disconnected', handleSubbotDisconnected);
    socket.on('subbot:connected', handleSubbotConnected);
    socket.on('subbot:pairingCode', handlePairingCode);
    socket.on('subbot:qr', handleQRCode);
    socket.on('subbot:updated', handleSubbotUpdated);

    return () => {
      socket.off('subbot:deleted', handleSubbotDeleted);
      socket.off('subbot:disconnected', handleSubbotDisconnected);
      socket.off('subbot:connected', handleSubbotConnected);
      socket.off('subbot:pairingCode', handlePairingCode);
      socket.off('subbot:qr', handleQRCode);
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
	      qr_data: raw?.qr_data ?? raw?.qr_code ?? null,
	      pairingCode: raw?.pairingCode ?? raw?.pairing_code ?? null,
	      isOnline: Boolean(raw?.isOnline || raw?.connected),
	      whatsapp_status: raw?.whatsapp_status ?? raw?.status_whatsapp ?? raw?.bio ?? null,
	    };
	  };

  useEffect(() => {
    loadSubbots();
  }, [loadSubbots]);

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
        toast.success('¡Instancia QR creada! Escanea el código que aparecerá abajo.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al crear la instancia QR');
    } finally {
      setActionLoading(null);
    }
  };

  const createCodeSubbot = async () => {
    if (!phoneNumber.trim()) {
      toast.error('Por favor, ingresa un número de teléfono');
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
          toast.success('Código de vinculación generado con éxito');
        } else {
          setPendingPairingSubbotCode(newSubbot.code);
          toast.success('Instancia creada. Generando código de vinculación...');
        }
        setPhoneNumber('');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al crear la instancia por código');
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
      toast.success('Subbot eliminado correctamente');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al eliminar subbot');
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
      toast.error('QR no disponible para este subbot');
    }
  }
} catch {
  toast.error('Error obteniendo QR');
}
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
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
    <div className="space-y-6">
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
      <Stagger className="grid grid-cols-1 md:grid-cols-4 gap-6" delay={0.02} stagger={0.07}>
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
        <Card animated delay={0.2} className="p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Crear Nuevo Subbot</h2>
          <div className="flex gap-4">
            <Button onClick={createQRSubbot} loading={actionLoading === 'qr'} variant="primary" icon={<QrCode className="w-5 h-5" />}>
              Crear QR Subbot
            </Button>
            <Button onClick={() => { setPendingPairingSubbotCode(null); setShowPhoneModal(true); }} loading={actionLoading === 'code'} variant="success" icon={<Key className="w-5 h-5" />}>
              Crear CODE Subbot
            </Button>
          </div>
          <p className="text-sm text-gray-400 mt-3">
            • <strong className="text-gray-300">QR Subbot:</strong> Escanea el código QR con WhatsApp<br />
            • <strong className="text-gray-300">CODE Subbot:</strong> Usa el código de emparejamiento
          </p>
          {isSocketConnected && (
            <p className="text-sm text-emerald-400 mt-2 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Los códigos QR y de pairing aparecerán automáticamente en tiempo real
            </p>
          )}
        </Card>
      </Reveal>

      {/* Subbots List */}
      <Card animated delay={0.3} className="overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white">Subbots Activos</h2>
          <p className="text-gray-400 mt-1">
            <AnimatedNumber value={subbots.length} /> subbot{subbots.length !== 1 ? 's' : ''} configurado{subbots.length !== 1 ? 's' : ''}
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Cargando subbots...</p>
          </div>
        ) : subbots.length === 0 ? (
          <div className="p-8 text-center">
            <Bot className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No hay subbots</h3>
            <p className="text-gray-400">Crea tu primer subbot para comenzar</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {subbots.map((subbot, index) => (
              <motion.div key={subbot.id || subbot.code} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }} className="p-4 md:p-6 hover:bg-white/5 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3 md:gap-6">
                    <div className="flex items-center gap-2 min-w-[120px]">
                      {subbot.isOnline ? <Wifi className="w-5 h-5 text-emerald-400" /> : <WifiOff className="w-5 h-5 text-gray-500" />}
                      <span className={`px-2 py-1 rounded-full text-[10px] md:text-xs font-medium border ${getStatusColor(subbot)}`}>
                        {getStatusText(subbot)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {subbot.type === 'qr' ? <QrCode className="w-4 h-4 text-blue-400" /> : <Key className="w-4 h-4 text-emerald-400" />}
                      <span className={`px-2 py-1 rounded-full text-[10px] md:text-xs font-medium border ${
                        subbot.type === 'qr' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      }`}>
                        {subbot.type === 'qr' ? 'QR Code' : 'Pairing Code'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <span className="text-sm text-gray-200 font-medium truncate max-w-[150px] md:max-w-none">
                        {subbot.whatsappName || subbot.numero || subbot.code}
                      </span>
                      <code className="text-[10px] text-gray-500 font-mono bg-white/5 px-2 py-1 rounded shrink-0">{subbot.code}</code>
                    </div>

                    {subbot.numero && (
                      <div className="flex items-center gap-2 text-gray-400 hidden sm:flex">
                        <Smartphone className="w-4 h-4" />
                        <span className="text-sm">{subbot.numero}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between lg:justify-end gap-4 border-t lg:border-t-0 border-white/5 pt-3 lg:pt-0">
                    <div className="text-left lg:text-right text-[10px] md:text-sm text-gray-500">
                      <div className="flex lg:block gap-2">
                        <span>Creado: {formatDate(subbot.fecha_creacion)}</span>
                        <span className="lg:hidden">•</span>
                        <span>Usuario: {subbot.usuario}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {subbot.type === 'qr' && !subbot.isOnline && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => viewQR(subbot)}
                          className="px-3"
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
                              toast.error('Generando código... espera un momento');
                            }
                          }}
                          className="px-3"
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
                        className="h-9 w-9 text-gray-400 hover:text-white"
                        icon={<Settings className="w-4 h-4" />}
                      />
                      {canDeleteSubbots && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteSubbot(subbot.code)}
                          disabled={actionLoading === `delete-${subbot.code}`}
                          title="Eliminar"
                          className="h-9 w-9 text-gray-400 hover:text-red-400"
                          loading={actionLoading === `delete-${subbot.code}`}
                          icon={<Trash2 className="w-4 h-4" />}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      {/* Phone Modal */}
      <Modal isOpen={showPhoneModal} onClose={handleClosePhoneModal} title="Crear Subbot con Código">
        <p className="text-sm text-gray-400 mb-4">
          Ingresa el número de WhatsApp (con código de país) para generar el código de emparejamiento.
        </p>
        <div className="mb-4">
          <label className="text-sm text-gray-400 mb-1 block">Número de WhatsApp</label>
          <input type="tel" placeholder="Ejemplo: 01231313" value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="input-glass w-full"
            data-autofocus />
        </div>
        {isSocketConnected && (
          <p className="text-sm text-emerald-400 mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            El código aparecerá automáticamente
          </p>
        )}
        <div className="flex gap-3">
          <Button onClick={handleClosePhoneModal} variant="secondary" className="flex-1">Cancelar</Button>
          <Button onClick={createCodeSubbot} loading={actionLoading === 'code'} disabled={!phoneNumber.trim()} variant="success" className="flex-1">
            Crear Subbot
          </Button>
        </div>
      </Modal>

      {/* Pairing Code Modal */}
      <Modal isOpen={showPairingModal && !!currentPairingCode} onClose={handleClosePairingModal} className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-emerald-500/20 rounded-full flex items-center justify-center">
          <Key className="w-8 h-8 text-emerald-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">¡Código de Pairing Generado!</h3>
        <p className="text-sm text-gray-400 mb-4">Ingresa este código en WhatsApp para vincular el subbot</p>
        <div className="bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-xl p-6 mb-4 border border-emerald-500/30">
          <motion.code initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-4xl font-mono font-bold text-emerald-400 tracking-wider">
            {currentPairingCode}
          </motion.code>
        </div>
        <p className="text-xs text-gray-500 mb-4">Subbot: <code className="text-gray-400">{currentPairingSubbot}</code></p>
        <div className="flex gap-3">
          <Button onClick={() => copyToClipboard(currentPairingCode!)} variant="success" className="flex-1" icon={<Copy className="w-4 h-4" />}>
            Copiar Código
          </Button>
          <Button onClick={handleClosePairingModal} variant="secondary" className="flex-1">
            Cerrar
          </Button>
        </div>
      </Modal>

      {/* QR Modal */}
      <Modal isOpen={showQR && !!selectedSubbot && !!qrImage} onClose={handleCloseQRModal} className="text-center">
        <h3 className="text-xl font-semibold text-white mb-4">Código QR del Subbot</h3>
        {qrImage && <img src={qrImage} alt="QR Code" className="mx-auto mb-4 rounded-xl bg-white p-2" decoding="async" />}
        <p className="text-sm text-gray-400 mb-4">Escanea este código con WhatsApp para conectar el subbot</p>
        <div className="flex gap-2 justify-center">
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
      </Modal>

      {/* Settings Modal */}
      <Modal isOpen={showSettingsModal} onClose={handleCloseSettingsModal} title="Configuración de Subbot">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-400" /> Alias Local (Solo Panel)
            </label>
            <input
              type="text"
              placeholder="Ej: Bot Ventas 1"
              value={settingsForm.alias}
              onChange={(e) => setSettingsForm(prev => ({ ...prev, alias: e.target.value }))}
              className="input-glass w-full text-white"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-1 block flex items-center gap-2">
              <User className="w-4 h-4 text-blue-400" /> Nombre de Perfil (WhatsApp)
            </label>
            <input
              type="text"
              placeholder="Nombre visible en WhatsApp"
              value={settingsForm.name}
              onChange={(e) => setSettingsForm(prev => ({ ...prev, name: e.target.value }))}
              className="input-glass w-full text-white"
            />
            {!settingsSubbot?.isOnline && (
              <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Requiere que el bot esté conectado para sincronizar con WhatsApp
              </p>
            )}
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-1 block flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-400" /> Bio / Estado (WhatsApp)
            </label>
            <textarea
              placeholder="Estado de WhatsApp..."
              value={settingsForm.status}
              onChange={(e) => setSettingsForm(prev => ({ ...prev, status: e.target.value }))}
              className="input-glass w-full text-white h-20 resize-none"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-1 block flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-blue-400" /> Foto de Perfil (WhatsApp)
            </label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border border-white/20 shrink-0">
                {settingsForm.pfp ? (
                  <img src={settingsForm.pfp} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-gray-600" />
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
                      ? 'bg-gray-500/10 text-gray-500 cursor-not-allowed' 
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <Download className="w-3 h-3" /> Seleccionar Imagen
                </label>
                <p className="text-[10px] text-gray-500 mt-1">Máx: 2MB. Recomendado: 640x640px</p>
              </div>
            </div>
            {!settingsSubbot?.isOnline && (
              <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Debes estar conectado para cambiar la foto
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
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
