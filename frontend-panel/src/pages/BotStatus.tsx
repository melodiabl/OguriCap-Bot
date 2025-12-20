import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Wifi,
  WifiOff,
  RefreshCw,
  Power,
  PowerOff,
  QrCode,
  Smartphone,
  Clock,
  Activity,
  AlertCircle,
  CheckCircle,
  Loader2,
  Radio,
} from 'lucide-react';
import { AnimatedCard, StatCard } from '../components/ui/AnimatedCard';
import { AnimatedButton, ToggleButton } from '../components/ui/AnimatedButton';
import { StatusIndicator, RealTimeBadge } from '../components/ui/StatusIndicator';
import { ProgressRing } from '../components/ui/Charts';
import { useBotStatus, useQRCode, useGlobalBotState, useSystemStats } from '../hooks/useRealTime';
import { useSocketBotStatus, useSocketNotifications } from '../hooks/useSocketEvents';
import { useSocket } from '../contexts/SocketContext';
import api from '../config/api';
import toast from 'react-hot-toast';

export const BotStatus: React.FC = () => {
  const [authMethod, setAuthMethod] = useState<'qr' | 'pairing'>('qr');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const { status, isConnected, isConnecting: botConnecting, refetch } = useBotStatus(3000);
  const { qrCode, available: qrAvailable, refetch: refetchQR } = useQRCode(!isConnected && authMethod === 'qr', 3000);
  const { isOn, setGlobalState, refetch: refetchGlobal } = useGlobalBotState(5000);
  const { memoryUsage, uptime } = useSystemStats(10000);

  // Socket.IO para actualizaciones en tiempo real
  const { isConnected: isSocketConnected } = useSocket();
  const { botStatus: socketBotStatus } = useSocketBotStatus();
  useSocketNotifications();

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setPairingCode(null);
    try {
      if (authMethod === 'pairing') {
        if (!phoneNumber) {
          toast.error('Ingresa un número de teléfono');
          setIsConnecting(false);
          return;
        }
        
        // Conectar con método pairing - el backend generará el código
        const response = await api.post('/api/bot/main/connect', {
          method: 'pairing',
          phoneNumber: phoneNumber.replace(/\D/g, ''),
        });
        
        if (response.data?.pairingCode) {
          setPairingCode(response.data.pairingCode);
          toast.success('Código de emparejamiento generado');
        } else {
          // Si no viene el código en la respuesta, intentar obtenerlo
          setTimeout(async () => {
            try {
              const codeResponse = await api.post('/api/bot/main/pairing', {
                phoneNumber: phoneNumber.replace(/\D/g, ''),
              });
              if (codeResponse.data?.pairingCode) {
                setPairingCode(codeResponse.data.pairingCode);
                toast.success('Código de emparejamiento generado');
              }
            } catch (e) {
              console.error('Error obteniendo código:', e);
            }
          }, 3000);
        }
      } else {
        // Método QR
        await api.post('/api/bot/main/connect', { method: 'qr' });
        toast.success('Generando código QR...');
        // El QR se actualizará automáticamente via polling o Socket.IO
        setTimeout(() => refetchQR(), 2000);
      }
      refetch();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Error al conectar');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.post('/api/bot/main/disconnect');
      toast.success('Bot desconectado');
      refetch();
    } catch (error) {
      toast.error('Error al desconectar');
    }
  };

  const handleRestart = async () => {
    try {
      await api.post('/api/bot/main/restart');
      toast.success('Bot reiniciado');
      refetch();
    } catch (error) {
      toast.error('Error al reiniciar');
    }
  };

  const handleGlobalToggle = async () => {
    try {
      await setGlobalState(!isOn);
      toast.success(isOn ? 'Bot desactivado globalmente' : 'Bot activado globalmente');
    } catch (error) {
      toast.error('Error al cambiar estado global');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h1 className="text-3xl font-bold text-white">Estado del Bot</h1>
          <p className="text-gray-400 mt-1">Gestiona la conexión y configuración del bot principal</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          {/* Indicador de Socket.IO */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            isSocketConnected 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            <Radio className={`w-3 h-3 ${isSocketConnected ? 'animate-pulse' : ''}`} />
            {isSocketConnected ? 'Tiempo Real' : 'Sin conexión'}
          </div>
          <RealTimeBadge isActive={isConnected} />
          <AnimatedButton
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={() => {
              refetch();
              refetchGlobal();
            }}
          >
            Actualizar
          </AnimatedButton>
        </motion.div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Connection Status Card */}
        <AnimatedCard delay={0.1} className="lg:col-span-2">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Estado de Conexión</h3>
              <StatusIndicator
                status={botConnecting ? 'connecting' : isConnected ? 'online' : 'offline'}
                size="lg"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Status visualization */}
              <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-white/5">
                <motion.div
                  animate={isConnected ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <ProgressRing
                    progress={isConnected ? 100 : botConnecting ? 50 : 0}
                    size={160}
                    strokeWidth={12}
                    color={isConnected ? '#10b981' : botConnecting ? '#f59e0b' : '#ef4444'}
                    label={isConnected ? 'Conectado' : botConnecting ? 'Conectando...' : 'Desconectado'}
                  />
                </motion.div>

                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-400">
                    {status?.phone ? `Número: ${status.phone}` : 'Sin número conectado'}
                  </p>
                </div>
              </div>

              {/* Connection info */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3 mb-2">
                    <Clock className="w-5 h-5 text-primary-400" />
                    <span className="text-gray-400">Uptime</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {status?.uptime || formatUptime(uptime)}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3 mb-2">
                    <Activity className="w-5 h-5 text-emerald-400" />
                    <span className="text-gray-400">Última actividad</span>
                  </div>
                  <p className="text-lg font-medium text-white">
                    {status?.lastSeen
                      ? new Date(status.lastSeen).toLocaleString()
                      : 'Sin actividad reciente'}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3 mb-2">
                    <Smartphone className="w-5 h-5 text-cyan-400" />
                    <span className="text-gray-400">Estado del sistema</span>
                  </div>
                  <p className="text-lg font-medium text-white">
                    {status?.connectionStatus || 'Desconocido'}
                  </p>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-white/10">
              {isConnected ? (
                <>
                  <AnimatedButton
                    variant="danger"
                    icon={<PowerOff className="w-4 h-4" />}
                    onClick={handleDisconnect}
                  >
                    Desconectar
                  </AnimatedButton>
                  <AnimatedButton
                    variant="secondary"
                    icon={<RefreshCw className="w-4 h-4" />}
                    onClick={handleRestart}
                  >
                    Reiniciar
                  </AnimatedButton>
                </>
              ) : (
                <AnimatedButton
                  variant="success"
                  icon={<Power className="w-4 h-4" />}
                  onClick={handleConnect}
                  loading={isConnecting}
                >
                  Conectar Bot
                </AnimatedButton>
              )}
            </div>
          </div>
        </AnimatedCard>

        {/* Global Control Card */}
        <AnimatedCard delay={0.2}>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Control Global</h3>

            <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-white/5 mb-6">
              <motion.div
                animate={isOn ? { scale: [1, 1.1, 1] } : {}}
                transition={{ repeat: Infinity, duration: 2 }}
                className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 ${
                  isOn
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-glow-emerald'
                    : 'bg-gradient-to-br from-red-500 to-rose-600 shadow-[0_0_20px_rgba(239,68,68,0.5)]'
                }`}
              >
                {isOn ? (
                  <CheckCircle className="w-12 h-12 text-white" />
                ) : (
                  <AlertCircle className="w-12 h-12 text-white" />
                )}
              </motion.div>

              <p className="text-xl font-bold text-white mb-2">
                Bot {isOn ? 'Activo' : 'Inactivo'}
              </p>
              <p className="text-sm text-gray-400 text-center mb-4">
                {isOn
                  ? 'El bot está respondiendo a todos los grupos'
                  : 'El bot no responderá a ningún mensaje'}
              </p>

              <ToggleButton
                isOn={isOn}
                onToggle={handleGlobalToggle}
                size="lg"
                label={isOn ? 'Encendido' : 'Apagado'}
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 rounded-xl bg-white/5">
                <span className="text-gray-400 text-sm">Memoria</span>
                <span className="text-white font-medium">
                  {memoryUsage?.systemPercentage || 0}%
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-white/5">
                <span className="text-gray-400 text-sm">CPU</span>
                <span className="text-white font-medium">~32%</span>
              </div>
            </div>
          </div>
        </AnimatedCard>
      </div>

      {/* QR / Pairing Section */}
      {!isConnected && (
        <AnimatedCard delay={0.3}>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Método de Conexión</h3>

            {/* Method selector */}
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setAuthMethod('qr')}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  authMethod === 'qr'
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <QrCode className={`w-8 h-8 mx-auto mb-2 ${authMethod === 'qr' ? 'text-primary-400' : 'text-gray-400'}`} />
                <p className={`font-medium ${authMethod === 'qr' ? 'text-white' : 'text-gray-400'}`}>
                  Código QR
                </p>
                <p className="text-xs text-gray-500 mt-1">Escanea con WhatsApp</p>
              </button>

              <button
                onClick={() => setAuthMethod('pairing')}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  authMethod === 'pairing'
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <Smartphone className={`w-8 h-8 mx-auto mb-2 ${authMethod === 'pairing' ? 'text-primary-400' : 'text-gray-400'}`} />
                <p className={`font-medium ${authMethod === 'pairing' ? 'text-white' : 'text-gray-400'}`}>
                  Código de 8 dígitos
                </p>
                <p className="text-xs text-gray-500 mt-1">Vincula con número</p>
              </button>
            </div>

            {/* QR Code display */}
            <AnimatePresence mode="wait">
              {authMethod === 'qr' && (
                <motion.div
                  key="qr"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="flex flex-col items-center"
                >
                  {qrCode ? (
                    <div className="qr-container">
                      <img
                        src={`data:image/png;base64,${qrCode}`}
                        alt="QR Code"
                        className="w-64 h-64"
                      />
                    </div>
                  ) : (
                    <div className="w-64 h-64 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                      {botConnecting ? (
                        <Loader2 className="w-12 h-12 text-primary-400 animate-spin" />
                      ) : (
                        <div className="text-center">
                          <QrCode className="w-12 h-12 text-gray-500 mx-auto mb-2" />
                          <p className="text-gray-400 text-sm">
                            Haz clic en "Conectar Bot" para generar el QR
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-sm text-gray-400 mt-4 text-center">
                    Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo
                  </p>
                </motion.div>
              )}

              {authMethod === 'pairing' && (
                <motion.div
                  key="pairing"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="max-w-md mx-auto"
                >
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Número de teléfono (con código de país)
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Ej: 521234567890"
                      className="input-glass"
                    />
                  </div>

                  {pairingCode && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-6 rounded-xl bg-gradient-to-br from-primary-500/20 to-violet-500/20 border border-primary-500/30 text-center mb-4"
                    >
                      <p className="text-sm text-gray-400 mb-2">Tu código de emparejamiento:</p>
                      <p className="text-4xl font-mono font-bold text-white tracking-widest">
                        {pairingCode}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Ingresa este código en WhatsApp
                      </p>
                    </motion.div>
                  )}

                  <AnimatedButton
                    variant="primary"
                    fullWidth
                    icon={<Smartphone className="w-4 h-4" />}
                    onClick={handleConnect}
                    loading={isConnecting}
                  >
                    Generar Código
                  </AnimatedButton>

                  <p className="text-sm text-gray-400 mt-4 text-center">
                    Abre WhatsApp → Dispositivos vinculados → Vincular con número de teléfono
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </AnimatedCard>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Estado"
          value={isConnected ? 'Online' : 'Offline'}
          icon={isConnected ? <Wifi className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />}
          color={isConnected ? 'success' : 'danger'}
          delay={0.4}
        />
        <StatCard
          title="Uptime"
          value={status?.uptime || formatUptime(uptime)}
          icon={<Clock className="w-6 h-6" />}
          color="info"
          delay={0.5}
        />
        <StatCard
          title="Memoria"
          value={`${memoryUsage?.systemPercentage || 0}%`}
          icon={<Activity className="w-6 h-6" />}
          color="warning"
          delay={0.6}
        />
        <StatCard
          title="Global"
          value={isOn ? 'Activo' : 'Inactivo'}
          icon={isOn ? <CheckCircle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
          color={isOn ? 'success' : 'danger'}
          delay={0.7}
        />
      </div>
    </div>
  );
};

export default BotStatus;
