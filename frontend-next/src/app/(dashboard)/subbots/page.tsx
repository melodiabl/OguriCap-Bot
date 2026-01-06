'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  QrCode, Key, Trash2, RefreshCw, Wifi, WifiOff, Bot, AlertCircle,
  Download, Copy, Zap, Radio, Clock, Smartphone, CheckCircle, XCircle
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

interface Subbot {
  id: number;
  code: string;
  codigo: string;
  type: SubbotType;
  status: SubbotStatus;
  usuario: string;
  fecha_creacion: string;
  numero?: string | null;
  whatsappName?: string | null;
  aliasDir?: string | null;
  qr_data?: string | null;
  pairingCode?: string | null;
  isOnline?: boolean;
}

export default function SubbotsPage() {
  const [subbots, setSubbots] = useState<Subbot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedSubbot, setSelectedSubbot] = useState<Subbot | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [currentPairingCode, setCurrentPairingCode] = useState<string | null>(null);
  const [currentPairingSubbot, setCurrentPairingSubbot] = useState<string | null>(null);

  const { isConnected: isSocketConnected, socket } = useSocketConnection();
  const { isGloballyOn } = useBotGlobalState();
  const { user } = useAuth();
  const canDeleteSubbots = !!user && ['owner', 'admin', 'administrador'].includes(String(user.rol || '').toLowerCase());
  const isUsuario = !!user && String(user.rol || '').toLowerCase() === 'usuario';

  const loadSubbots = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.getSubbots();
      if (response) {
        setSubbots((Array.isArray(response) ? response : response.subbots || []).map(normalizeSubbot));
        setError(null);
      }
    } catch {
      setError('Error de conexión');
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
          return { ...s, isOnline: false, status: 'inactivo' as SubbotStatus };
        }
        return s;
      }));
    };

    const handleSubbotConnected = (data: { subbotCode: string; phone?: string }) => {
      setSubbots(prev => prev.map(s => {
        if (s.code === data.subbotCode || s.codigo === data.subbotCode) {
          return { ...s, isOnline: true, status: 'activo' as SubbotStatus, numero: data.phone || s.numero };
        }
        return s;
      }));
    };

    const handlePairingCode = (data: { subbotCode: string; pairingCode: string }) => {
      setCurrentPairingCode(data.pairingCode);
      setCurrentPairingSubbot(data.subbotCode);
      setShowPairingModal(true);
      setShowPhoneModal(false);
      loadSubbots();
    };

    const handleQRCode = async (data: { subbotCode: string; qr: string }) => {
      try {
        const qrDataURL = await QRCode.toDataURL(data.qr, { width: 256, margin: 2 });
        setQrImage(qrDataURL);
        const subbot = subbots.find(s => s.code === data.subbotCode);
        if (subbot) {
          setSelectedSubbot(subbot);
          setShowQR(true);
        }
      } catch (err) {
        console.error('Error generando QR:', err);
      }
      loadSubbots();
    };

    socket.on('subbot:deleted', handleSubbotDeleted);
    socket.on('subbot:disconnected', handleSubbotDisconnected);
    socket.on('subbot:connected', handleSubbotConnected);
    socket.on('subbot:pairingCode', handlePairingCode);
    socket.on('subbot:qr', handleQRCode);

    return () => {
      socket.off('subbot:deleted', handleSubbotDeleted);
      socket.off('subbot:disconnected', handleSubbotDisconnected);
      socket.off('subbot:connected', handleSubbotConnected);
      socket.off('subbot:pairingCode', handlePairingCode);
      socket.off('subbot:qr', handleQRCode);
    };
  }, [socket, subbots, loadSubbots]);

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
      usuario: String(raw?.usuario || raw?.owner || 'admin'),
      fecha_creacion: String(raw?.fecha_creacion || raw?.created_at || new Date().toISOString()),
      numero: raw?.numero ?? raw?.phoneNumber ?? null,
      whatsappName: raw?.nombre_whatsapp ?? raw?.whatsappName ?? null,
      aliasDir: raw?.alias_dir ?? raw?.aliasDir ?? null,
      qr_data: raw?.qr_data ?? raw?.qr_code ?? null,
      pairingCode: raw?.pairingCode ?? raw?.pairing_code ?? null,
      isOnline: Boolean(raw?.isOnline || raw?.connected),
    };
  };

  useEffect(() => {
    loadSubbots();
  }, [loadSubbots]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const getSubbotStatus = async () => {
    try {
      const data = await api.getSubbotStatus();
      if (data) {
        setSubbots(prev => prev.map(subbot => {
          const status = data.subbots?.find((s: any) => s.subbotId === subbot.code || s.code === subbot.code);
          return {
            ...subbot,
            isOnline: status?.isOnline || status?.connected || false,
            status: (status?.status || subbot.status) as SubbotStatus
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
      setError(null);
      const response = await api.createSubbot(1, 'qr');
      if (response) {
        const newSubbot = normalizeSubbot(response);
        setSubbots(prev => [newSubbot, ...prev]);
        setSuccess('Subbot QR creado - Esperando código QR...');
        toast.success('Subbot QR creado. El código QR aparecerá automáticamente.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Error al crear subbot QR');
      toast.error('Error al crear subbot QR');
    } finally {
      setActionLoading(null);
    }
  };

  const createCodeSubbot = async () => {
    if (!phoneNumber.trim()) {
      setError('Ingresa un número de teléfono válido');
      return;
    }
    try {
      setActionLoading('code');
      setError(null);
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
      const response = await api.createSubbot(1, 'code', cleanPhone);
      if (response) {
        const newSubbot = normalizeSubbot(response);
        setSubbots(prev => [newSubbot, ...prev]);
        if (response.pairingCode || response.pairing_code) {
          setCurrentPairingCode(response.pairingCode || response.pairing_code);
          setCurrentPairingSubbot(newSubbot.code);
          setShowPairingModal(true);
          setShowPhoneModal(false);
          toast.success('Código de pairing generado');
        } else {
          setSuccess('Subbot CODE creado - Esperando código de pairing...');
          toast.success('Subbot creado. El código de pairing aparecerá automáticamente.');
        }
        setPhoneNumber('');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Error al crear subbot CODE');
      toast.error('Error al crear subbot CODE');
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
      setSuccess('Subbot eliminado correctamente');
      toast.success('Subbot eliminado');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Error al eliminar subbot');
      toast.error('Error al eliminar subbot');
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
          setError('QR no disponible para este subbot');
        }
      }
    } catch {
      setError('Error obteniendo QR');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
  };

  const getStatusColor = (subbot: Subbot) => {
    // Si el bot está globalmente desactivado, mostrar como deshabilitado
    if (!isGloballyOn) return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    
    if (subbot.isOnline) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    const isPending = Boolean(subbot.qr_data || subbot.pairingCode);
    if (isPending) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    if (subbot.status === 'error') return 'bg-red-500/20 text-red-400 border-red-500/30';
    return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const getStatusText = (subbot: Subbot) => {
    // Si el bot está globalmente desactivado, mostrar estado global
    if (!isGloballyOn) return 'Bot Desactivado';
    
    if (subbot.isOnline) return 'Conectado';
    const isPending = Boolean(subbot.qr_data || subbot.pairingCode);
    if (isPending) return subbot.type === 'code' ? 'Esperando pairing' : 'Esperando QR';
    if (subbot.status === 'inactivo') return 'Inactivo';
    if (subbot.status === 'error') return 'Error';
    return 'Desconectado';
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

      {/* Alerts */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="glass-card p-4 border-red-500/30 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
              <XCircle className="w-4 h-4" />
            </button>
          </motion.div>
        )}
        {success && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="glass-card p-4 border-emerald-500/30 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="text-emerald-400">{success}</span>
          </motion.div>
        )}
      </AnimatePresence>

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
            value={subbots.filter(s => !s.isOnline && (s.qr_data || s.pairingCode)).length}
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
            <Button onClick={() => setShowPhoneModal(true)} loading={actionLoading === 'code'} variant="success" icon={<Key className="w-5 h-5" />}>
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
                transition={{ delay: index * 0.05 }} className="p-6 hover:bg-white/5 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      {subbot.isOnline ? <Wifi className="w-5 h-5 text-emerald-400" /> : <WifiOff className="w-5 h-5 text-gray-500" />}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(subbot)}`}>
                        {getStatusText(subbot)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {subbot.type === 'qr' ? <QrCode className="w-4 h-4 text-blue-400" /> : <Key className="w-4 h-4 text-emerald-400" />}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                        subbot.type === 'qr' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      }`}>
                        {subbot.type === 'qr' ? 'QR Code' : 'Pairing Code'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-200 font-medium">
                        {subbot.whatsappName || subbot.numero || subbot.code}
                      </span>
                      <code className="text-xs text-gray-500 font-mono bg-white/5 px-2 py-1 rounded">{subbot.code}</code>
                    </div>
                    {subbot.numero && (
                      <div className="flex items-center gap-2 text-gray-400">
                        <Smartphone className="w-4 h-4" />
                        <span className="text-sm">{subbot.numero}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm text-gray-500">
                      <div>Creado: {formatDate(subbot.fecha_creacion)}</div>
                      <div>Usuario: {subbot.usuario}</div>
                    </div>
                    <div className="flex gap-2">
                      {subbot.type === 'qr' && (
                        <button onClick={() => viewQR(subbot)} className="p-2 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors" title="Ver QR">
                          <QrCode className="w-4 h-4" />
                        </button>
                      )}
                      {subbot.type === 'code' && subbot.pairingCode && (
                        <button onClick={() => { setCurrentPairingCode(subbot.pairingCode!); setCurrentPairingSubbot(subbot.code); setShowPairingModal(true); }}
                          className="p-2 rounded-lg text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Ver Código">
                          <Key className="w-4 h-4" />
                        </button>
                      )}
                      {canDeleteSubbots && (
                        <button onClick={() => deleteSubbot(subbot.code)} disabled={actionLoading === `delete-${subbot.code}`}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Eliminar">
                          {actionLoading === `delete-${subbot.code}` ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
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
      <Modal isOpen={showPhoneModal} onClose={() => setShowPhoneModal(false)} title="Crear Subbot con Código">
        <p className="text-sm text-gray-400 mb-4">
          Ingresa el número de WhatsApp (con código de país) para generar el código de emparejamiento.
        </p>
        <div className="mb-4">
          <label className="text-sm text-gray-400 mb-1 block">Número de WhatsApp</label>
          <input type="tel" placeholder="Ejemplo: 595974154768" value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="input-glass w-full" />
        </div>
        {isSocketConnected && (
          <p className="text-sm text-emerald-400 mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            El código aparecerá automáticamente
          </p>
        )}
        <div className="flex gap-3">
          <Button onClick={() => setShowPhoneModal(false)} variant="secondary" className="flex-1">Cancelar</Button>
          <Button onClick={createCodeSubbot} loading={actionLoading === 'code'} disabled={!phoneNumber.trim()} variant="success" className="flex-1">
            Crear Subbot
          </Button>
        </div>
      </Modal>

      {/* Pairing Code Modal */}
      <Modal isOpen={showPairingModal && !!currentPairingCode} onClose={() => { setShowPairingModal(false); setCurrentPairingCode(null); }} className="text-center">
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
          <Button onClick={() => { setShowPairingModal(false); setCurrentPairingCode(null); }} variant="secondary" className="flex-1">
            Cerrar
          </Button>
        </div>
      </Modal>

      {/* QR Modal */}
      <Modal isOpen={showQR && !!selectedSubbot && !!qrImage} onClose={() => setShowQR(false)} className="text-center">
        <h3 className="text-xl font-semibold text-white mb-4">Código QR del Subbot</h3>
        {qrImage && <img src={qrImage} alt="QR Code" className="mx-auto mb-4 rounded-xl bg-white p-2" />}
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
    </div>
  );
}
