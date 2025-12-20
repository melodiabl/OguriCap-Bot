import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  QrCode,
  Key,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Smartphone,
  Bot,
  AlertCircle,
  Download,
  Copy,
  Wifi,
  WifiOff,
  Zap,
  Radio
} from 'lucide-react';
import { AnimatedCard, StatCard } from '../components/ui/AnimatedCard';
import { AnimatedButton, IconButton } from '../components/ui/AnimatedButton';
import { useSubbotsStatus } from '../hooks/useRealTime';
import { useSocketSubbots } from '../hooks/useSocketEvents';
import { useSocket } from '../contexts/SocketContext';
import api from '../config/api';
import toast from 'react-hot-toast';

type SubbotType = 'qr' | 'code';
type SubbotStatus = 'activo' | 'inactivo' | 'error';

interface Subbot {
  id: number;
  code: string;
  codigo: string;
  type: SubbotType;
  tipo: SubbotType;
  status: SubbotStatus;
  estado: SubbotStatus;
  usuario: string;
  created_at: string;
  fecha_creacion: string;
  numero?: string | null;
  phoneNumber?: string | null;
  qr_data?: string | null;
  qr_code?: string | null;
  isOnline?: boolean;
  pairingCode?: string | null;
  pairing_code?: string | null;
}

const Subbots: React.FC = () => {
  const [subbots, setSubbots] = useState<Subbot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedSubbot, setSelectedSubbot] = useState<Subbot | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [currentPairingCode, setCurrentPairingCode] = useState<string | null>(null);
  const [currentPairingSubbot, setCurrentPairingSubbot] = useState<string | null>(null);

  const { onlineCount } = useSubbotsStatus(10000);
  const { isConnected: isSocketConnected, socket } = useSocket();
  const { pendingPairingCode, pendingQR, clearPendingPairingCode, clearPendingQR } = useSocketSubbots();

  // Escuchar eventos de eliminación de subbots en tiempo real
  useEffect(() => {
    if (!socket) return;

    const handleSubbotDeleted = (data: { subbotCode: string }) => {
      console.log('[Subbots] Subbot eliminado desde el bot:', data.subbotCode);
      setSubbots(prev => prev.filter(s => 
        s.code !== data.subbotCode && 
        s.codigo !== data.subbotCode
      ));
    };

    const handleSubbotDisconnected = (data: { subbotCode: string; reason: string }) => {
      console.log('[Subbots] Subbot desconectado:', data.subbotCode, data.reason);
      setSubbots(prev => prev.map(s => {
        if (s.code === data.subbotCode || s.codigo === data.subbotCode) {
          return { ...s, isOnline: false, status: 'inactivo' as SubbotStatus, estado: 'inactivo' as SubbotStatus };
        }
        return s;
      }));
    };

    const handleSubbotConnected = (data: { subbotCode: string; phone?: string }) => {
      console.log('[Subbots] Subbot conectado:', data.subbotCode);
      setSubbots(prev => prev.map(s => {
        if (s.code === data.subbotCode || s.codigo === data.subbotCode) {
          return { 
            ...s, 
            isOnline: true, 
            status: 'activo' as SubbotStatus, 
            estado: 'activo' as SubbotStatus,
            numero: data.phone || s.numero,
            phoneNumber: data.phone || s.phoneNumber
          };
        }
        return s;
      }));
    };

    socket.on('subbot:deleted', handleSubbotDeleted);
    socket.on('subbot:disconnected', handleSubbotDisconnected);
    socket.on('subbot:connected', handleSubbotConnected);

    return () => {
      socket.off('subbot:deleted', handleSubbotDeleted);
      socket.off('subbot:disconnected', handleSubbotDisconnected);
      socket.off('subbot:connected', handleSubbotConnected);
    };
  }, [socket]);

  // Escuchar código de pairing en tiempo real
  useEffect(() => {
    if (pendingPairingCode) {
      setCurrentPairingCode(pendingPairingCode.pairingCode);
      setCurrentPairingSubbot(pendingPairingCode.subbotCode);
      setShowPairingModal(true);
      setShowPhoneModal(false);
      loadSubbots();
    }
  }, [pendingPairingCode]);

  // Escuchar QR en tiempo real
  useEffect(() => {
    if (pendingQR) {
      const generateQRImage = async () => {
        try {
          const QRCode = await import('qrcode');
          const qrDataURL = await QRCode.toDataURL(pendingQR.qr, {
            width: 256,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
          });
          setQrImage(qrDataURL);
          const subbot = subbots.find(s => s.code === pendingQR.subbotCode);
          if (subbot) {
            setSelectedSubbot(subbot);
            setShowQR(true);
          }
        } catch (err) {
          console.error('Error generando QR:', err);
        }
      };
      generateQRImage();
      loadSubbots();
    }
  }, [pendingQR, subbots]);

  const normalizeSubbot = (raw: any): Subbot => {
    const code = String(raw?.code || raw?.codigo || raw?.subbotCode || '').trim();
    const type: SubbotType = raw?.type === 'code' || raw?.tipo === 'code' ? 'code' : 'qr';
    const status: SubbotStatus = (raw?.status || raw?.estado || 'inactivo') as SubbotStatus;
    const createdAt = String(raw?.created_at || raw?.fecha_creacion || new Date().toISOString());
    const numero = raw?.numero ?? raw?.phoneNumber ?? raw?.phone_number ?? null;
    const qrData = raw?.qr_data ?? raw?.qr_code ?? null;
    const pairingCode = raw?.pairingCode ?? raw?.pairing_code ?? null;

    return {
      id: Number(raw?.id || 0),
      code,
      codigo: String(raw?.codigo || code),
      type,
      tipo: type,
      status,
      estado: status,
      usuario: String(raw?.usuario || raw?.owner || 'admin'),
      created_at: createdAt,
      fecha_creacion: String(raw?.fecha_creacion || createdAt),
      numero: numero ? String(numero) : null,
      phoneNumber: numero ? String(numero) : null,
      qr_data: qrData ? String(qrData) : null,
      qr_code: qrData ? String(qrData) : null,
      pairingCode: pairingCode ? String(pairingCode) : null,
      pairing_code: pairingCode ? String(pairingCode) : null,
      isOnline: Boolean(raw?.isOnline),
    };
  };

  const loadSubbots = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/subbots');
      if (response.data) {
        setSubbots((Array.isArray(response.data) ? response.data : []).map(normalizeSubbot));
        setError(null);
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubbots();
    const interval = setInterval(() => {
      getSubbotStatus();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadSubbots]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const getSubbotStatus = async () => {
    try {
      const response = await api.get('/api/subbot/status');
      if (response.data) {
        const data = response.data;
        setSubbots(prev => prev.map(subbot => {
          const status = data.subbots?.find((s: any) => s.subbotId === subbot.code);
          const nextStatus = (status?.status || subbot.status) as SubbotStatus;
          return {
            ...subbot,
            isOnline: status?.isOnline || false,
            status: nextStatus,
            estado: nextStatus
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
      const response = await api.post('/api/subbots/qr', { usuario: 'admin' });

      if (response.data) {
        const newSubbot = normalizeSubbot(response.data);
        setSubbots(prev => [newSubbot, ...prev]);
        setSuccess('Subbot QR creado - Esperando código QR...');
        toast.success('Subbot QR creado. El código QR aparecerá automáticamente.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Error al crear subbot QR');
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
      const response = await api.post('/api/subbots/code', {
        usuario: 'admin',
        numero: cleanPhone
      });

      if (response.data) {
        const data = response.data;
        const newSubbot = normalizeSubbot(data);
        setSubbots(prev => [newSubbot, ...prev]);
        
        // Si el código de pairing viene en la respuesta, mostrarlo
        if (data.pairingCode || data.pairing_code) {
          setCurrentPairingCode(data.pairingCode || data.pairing_code);
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
    } finally {
      setActionLoading(null);
    }
  };

  const deleteSubbot = async (idOrCode: string | number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este subbot?')) return;

    try {
      const key = String(idOrCode);
      setActionLoading(`delete-${key}`);
      await api.delete(`/api/subbots/${encodeURIComponent(key)}`);
      setSubbots(prev => prev.filter(s => String(s.id) !== key && s.code !== key && s.codigo !== key));
      setSuccess('Subbot eliminado correctamente');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Error al eliminar subbot');
    } finally {
      setActionLoading(null);
    }
  };

  const viewQR = async (subbot: Subbot) => {
    try {
      if (subbot.qr_data) {
        const QRCode = await import('qrcode');
        const qrDataURL = await QRCode.toDataURL(subbot.qr_data, {
          width: 256,
          margin: 2,
          color: { dark: '#000000', light: '#FFFFFF' }
        });
        setQrImage(qrDataURL);
        setSelectedSubbot(subbot);
        setShowQR(true);
      } else {
        const response = await api.get(`/api/subbots/${subbot.code}/qr`);
        if (response.data) {
          setQrImage(`data:image/png;base64,${response.data.qr}`);
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

  const viewCode = (subbot: Subbot) => {
    setSelectedSubbot(subbot);
    setShowCode(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
  };

  const getStatusColor = (status: string, isOnline: boolean) => {
    if (isOnline) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (status === 'activo') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    if (status === 'error') return 'bg-red-500/20 text-red-400 border-red-500/30';
    return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const getStatusText = (status: string, isOnline: boolean) => {
    if (isOnline) return 'Conectado';
    if (status === 'activo') return 'Activo';
    if (status === 'inactivo') return 'Inactivo';
    if (status === 'error') return 'Error';
    return 'Desconectado';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES');
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-xl">
                <Bot className="w-8 h-8 text-blue-400" />
              </div>
              Gestión de Subbots
            </h1>
            <p className="text-gray-400 mt-2">Crea y gestiona subbots para conectar múltiples cuentas de WhatsApp</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Indicador de Socket.IO */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
              isSocketConnected 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              <Radio className={`w-3 h-3 ${isSocketConnected ? 'animate-pulse' : ''}`} />
              {isSocketConnected ? 'Tiempo Real' : 'Sin conexión'}
            </div>
            <AnimatedButton
              onClick={loadSubbots}
              variant="secondary"
              loading={loading}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              Actualizar
            </AnimatedButton>
          </div>
        </motion.div>

        {/* Alertas */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-card p-4 border-red-500/30 flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-400">{error}</span>
              <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
                <XCircle className="w-4 h-4" />
              </button>
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-card p-4 border-emerald-500/30 flex items-center gap-3"
            >
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span className="text-emerald-400">{success}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard
            title="Total Subbots"
            value={subbots.length}
            subtitle={`${subbots.filter(s => s.type === 'qr').length} QR • ${subbots.filter(s => s.type === 'code').length} Códigos`}
            icon={<Bot className="w-6 h-6" />}
            color="info"
            delay={0}
          />
          <StatCard
            title="Conectados"
            value={subbots.filter(s => s.isOnline).length}
            subtitle="Activos ahora"
            icon={<Wifi className="w-6 h-6" />}
            color="success"
            delay={0.1}
          />
          <StatCard
            title="Esperando"
            value={subbots.filter(s => !s.isOnline && s.status === 'activo').length}
            subtitle="Por conectar"
            icon={<Clock className="w-6 h-6" />}
            color="warning"
            delay={0.2}
          />
          <StatCard
            title="Tiempo Real"
            value={isSocketConnected ? 'Activo' : 'Inactivo'}
            subtitle="Socket.IO"
            icon={<Zap className="w-6 h-6" />}
            color={isSocketConnected ? 'success' : 'danger'}
            delay={0.3}
          />
        </div>

        {/* Crear Subbot */}
        <AnimatedCard delay={0.2} className="p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Crear Nuevo Subbot</h2>
          <div className="flex gap-4">
            <AnimatedButton
              onClick={createQRSubbot}
              loading={actionLoading === 'qr'}
              variant="primary"
              icon={<QrCode className="w-5 h-5" />}
            >
              Crear QR Subbot
            </AnimatedButton>
            <AnimatedButton
              onClick={() => setShowPhoneModal(true)}
              loading={actionLoading === 'code'}
              variant="success"
              icon={<Key className="w-5 h-5" />}
            >
              Crear CODE Subbot
            </AnimatedButton>
          </div>
          <p className="text-sm text-gray-400 mt-3">
            • <strong className="text-gray-300">QR Subbot:</strong> Escanea el código QR con WhatsApp<br />
            • <strong className="text-gray-300">CODE Subbot:</strong> Usa el código de emparejamiento (aparecerá automáticamente)
          </p>
          {isSocketConnected && (
            <p className="text-sm text-emerald-400 mt-2 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Los códigos QR y de pairing aparecerán automáticamente en tiempo real
            </p>
          )}
        </AnimatedCard>

        {/* Lista */}
        <AnimatedCard delay={0.3} className="overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-xl font-semibold text-white">Subbots Activos</h2>
            <p className="text-gray-400 mt-1">{subbots.length} subbot{subbots.length !== 1 ? 's' : ''} configurado{subbots.length !== 1 ? 's' : ''}</p>
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
                <motion.div
                  key={subbot.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-6 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        {subbot.isOnline ? (
                          <Wifi className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <WifiOff className="w-5 h-5 text-gray-500" />
                        )}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(subbot.status, subbot.isOnline || false)}`}>
                          {getStatusText(subbot.status, subbot.isOnline || false)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {subbot.type === 'qr' ? <QrCode className="w-4 h-4 text-blue-400" /> : <Key className="w-4 h-4 text-emerald-400" />}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${subbot.type === 'qr' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
                          {subbot.type === 'qr' ? 'QR Code' : 'Pairing Code'}
                        </span>
                      </div>
                      <code className="text-sm text-gray-400 font-mono bg-white/5 px-2 py-1 rounded">{subbot.code}</code>
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
                          <IconButton
                            icon={<QrCode className="w-4 h-4" />}
                            onClick={() => viewQR(subbot)}
                            variant="ghost"
                            tooltip="Ver QR"
                          />
                        )}
                        {subbot.type === 'code' && subbot.pairingCode && (
                          <IconButton
                            icon={<Key className="w-4 h-4" />}
                            onClick={() => viewCode(subbot)}
                            variant="ghost"
                            tooltip="Ver Código"
                          />
                        )}
                        <IconButton
                          icon={<Trash2 className="w-4 h-4" />}
                          onClick={() => deleteSubbot(subbot.code)}
                          loading={actionLoading === `delete-${subbot.code}`}
                          variant="danger"
                          tooltip="Eliminar"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatedCard>

        {/* Modal Teléfono */}
        <AnimatePresence>
          {showPhoneModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowPhoneModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="glass-card p-6 w-full max-w-md"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-xl font-semibold text-white mb-4">Crear Subbot con Código</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Ingresa el número de WhatsApp (con código de país) para generar el código de emparejamiento.
                </p>
                <div className="mb-4">
                  <label className="text-sm text-gray-400 mb-1 block">Número de WhatsApp</label>
                  <input
                    type="tel"
                    placeholder="Ejemplo: 595974154768"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-800/80 border border-white/10 rounded-xl text-gray-100 placeholder-gray-400 focus:border-emerald-500/50 transition-all"
                  />
                </div>
                {isSocketConnected && (
                  <p className="text-sm text-emerald-400 mb-4 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    El código aparecerá automáticamente
                  </p>
                )}
                <div className="flex gap-3">
                  <AnimatedButton onClick={() => setShowPhoneModal(false)} variant="secondary" fullWidth>
                    Cancelar
                  </AnimatedButton>
                  <AnimatedButton
                    onClick={createCodeSubbot}
                    loading={actionLoading === 'code'}
                    disabled={!phoneNumber.trim()}
                    variant="success"
                    fullWidth
                  >
                    Crear Subbot
                  </AnimatedButton>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Código de Pairing en Tiempo Real */}
        <AnimatePresence>
          {showPairingModal && currentPairingCode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => {
                setShowPairingModal(false);
                clearPendingPairingCode();
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="glass-card p-6 w-full max-w-md text-center"
                onClick={e => e.stopPropagation()}
              >
                <div className="w-16 h-16 mx-auto mb-4 bg-emerald-500/20 rounded-full flex items-center justify-center">
                  <Key className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">¡Código de Pairing Generado!</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Ingresa este código en WhatsApp para vincular el subbot
                </p>
                <div className="bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-xl p-6 mb-4 border border-emerald-500/30">
                  <motion.code 
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="text-4xl font-mono font-bold text-emerald-400 tracking-wider"
                  >
                    {currentPairingCode}
                  </motion.code>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Subbot: <code className="text-gray-400">{currentPairingSubbot}</code>
                </p>
                <div className="flex gap-3">
                  <AnimatedButton
                    onClick={() => copyToClipboard(currentPairingCode)}
                    variant="success"
                    fullWidth
                    icon={<Copy className="w-4 h-4" />}
                  >
                    Copiar Código
                  </AnimatedButton>
                  <AnimatedButton
                    onClick={() => {
                      setShowPairingModal(false);
                      clearPendingPairingCode();
                    }}
                    variant="secondary"
                    fullWidth
                  >
                    Cerrar
                  </AnimatedButton>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal QR */}
        <AnimatePresence>
          {showQR && selectedSubbot && qrImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => {
                setShowQR(false);
                clearPendingQR();
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="glass-card p-6 w-full max-w-md text-center"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-xl font-semibold text-white mb-4">Código QR del Subbot</h3>
                <img src={qrImage} alt="QR Code" className="mx-auto mb-4 rounded-xl bg-white p-2" />
                <p className="text-sm text-gray-400 mb-4">Escanea este código con WhatsApp para conectar el subbot</p>
                <div className="flex gap-2 justify-center">
                  <AnimatedButton
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = qrImage;
                      link.download = `subbot-qr-${selectedSubbot.code}.png`;
                      link.click();
                    }}
                    variant="primary"
                    icon={<Download className="w-4 h-4" />}
                  >
                    Descargar
                  </AnimatedButton>
                  <AnimatedButton
                    onClick={() => copyToClipboard(selectedSubbot.qr_data || '')}
                    variant="secondary"
                    icon={<Copy className="w-4 h-4" />}
                  >
                    Copiar Datos
                  </AnimatedButton>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Código */}
        <AnimatePresence>
          {showCode && selectedSubbot?.pairingCode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowCode(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="glass-card p-6 w-full max-w-md text-center"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-xl font-semibold text-white mb-4">Código de Emparejamiento</h3>
                <div className="bg-white/10 rounded-xl p-4 mb-4">
                  <code className="text-3xl font-mono font-bold text-emerald-400">
                    {selectedSubbot.pairingCode}
                  </code>
                </div>
                <p className="text-sm text-gray-400 mb-4">Usa este código en WhatsApp para conectar el subbot</p>
                <AnimatedButton
                  onClick={() => copyToClipboard(selectedSubbot.pairingCode || '')}
                  variant="success"
                  icon={<Copy className="w-4 h-4" />}
                >
                  Copiar Código
                </AnimatedButton>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Subbots;
