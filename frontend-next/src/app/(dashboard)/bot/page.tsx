'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Wifi, WifiOff, RefreshCw, Power, PowerOff, QrCode, Smartphone,
  Clock, Activity, AlertCircle, CheckCircle, Loader2, Radio
} from 'lucide-react';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { ProgressRing } from '@/components/ui/Charts';
import { PageHeader } from '@/components/ui/PageHeader';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { useBotStatus, useBotGlobalState, useSystemStats } from '@/hooks/useRealTime';
import { useSocketBotStatus, useSocketConnection } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLoadingOverlay } from '@/contexts/LoadingOverlayContext';
import api from '@/services/api';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';

export default function BotStatusPage() {
  const [authMethod, setAuthMethod] = useState<'qr' | 'pairing'>('qr');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);

  const { status, isConnected, isConnecting: botConnecting, refetch } = useBotStatus(3000);
  const { isOn, setGlobalState, refetch: refetchGlobal } = useBotGlobalState(5000);
  const { memoryUsage, cpuUsage, diskUsage, uptime } = useSystemStats(10000);
  const { isConnected: isSocketConnected } = useSocketConnection();
  const socketBotStatus = useSocketBotStatus();
  const { user } = useAuth();
  const { withLoading } = useLoadingOverlay();

  const connected = socketBotStatus?.connected ?? isConnected;
  const connecting = socketBotStatus?.connecting ?? botConnecting ?? isConnecting;
  const canControl = !!user && ['owner', 'admin', 'administrador'].includes(String(user.rol || '').toLowerCase());

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // Generate QR image when available
  useEffect(() => {
    const qr = socketBotStatus?.qrCode || status?.qrCode;
    if (qr && !connected) {
      QRCode.toDataURL(qr, { width: 256, margin: 2 })
        .then(setQrImage)
        .catch(console.error);
    } else if (connected) {
      setQrImage(null);
    }
  }, [socketBotStatus?.qrCode, status?.qrCode, connected]);

  useEffect(() => {
    if (socketBotStatus?.pairingCode) setPairingCode(socketBotStatus.pairingCode);
  }, [socketBotStatus?.pairingCode]);

  useEffect(() => {
    if (connected) setPairingCode(null);
  }, [connected]);

  const handleConnect = async () => {
    if (!canControl) {
      toast.error('No tienes permisos para controlar el bot');
      return;
    }
    setIsConnecting(true);
    setPairingCode(null);
    try {
      if (authMethod === 'pairing') {
        if (!phoneNumber) {
          toast.error('Ingresa un número de teléfono');
          setIsConnecting(false);
          return;
        }
        const response = await api.connectMainBot('pairing', phoneNumber.replace(/\D/g, ''));
        if (response?.pairingCode) {
          setPairingCode(response.pairingCode);
          toast.success('Código de emparejamiento generado');
        } else if (!isSocketConnected) {
          setTimeout(async () => {
            try {
              const codeResponse = await api.getMainBotPairingCode();
              if (codeResponse?.code) {
                setPairingCode(codeResponse.code);
                toast.success('Código de emparejamiento generado');
              }
            } catch (e) {
              console.error('Error obteniendo código:', e);
            }
          }, 3000);
        }
      } else {
        await api.connectMainBot('qr');
        toast.success('Generando código QR...');
        setTimeout(() => refetch(), 2000);
      }
      refetch();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Error al conectar');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!canControl) {
      toast.error('No tienes permisos para controlar el bot');
      return;
    }
    try {
      await withLoading(() => api.disconnectMainBot(), { message: 'Desconectando bot...' });
      toast.success('Bot desconectado');
      refetch();
    } catch (error) {
      toast.error('Error al desconectar');
    }
  };

  const handleRestart = async () => {
    if (!canControl) {
      toast.error('No tienes permisos para controlar el bot');
      return;
    }
    try {
      await withLoading(() => api.restartMainBot(), { message: 'Reiniciando bot...', details: 'Esto puede tardar unos segundos.' });
      toast.success('Bot reiniciado');
      refetch();
    } catch (error) {
      toast.error('Error al reiniciar');
    }
  };

  const handleGlobalToggle = async () => {
    if (!canControl) {
      toast.error('No tienes permisos para controlar el bot');
      return;
    }
    try {
      await withLoading(() => setGlobalState(!isOn), {
        message: !isOn ? 'Activando bot globalmente...' : 'Desactivando bot globalmente...',
        details: 'Aplicando cambios en todos los grupos.',
      });
      toast.success(isOn ? 'Bot desactivado globalmente' : 'Bot activado globalmente');
    } catch (error) {
      toast.error('Error al cambiar estado global');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Estado del Bot"
        description="Gestiona la conexión y configuración del bot principal"
        icon={<Bot className="w-5 h-5 text-primary-400" />}
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

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Connection Status Card */}
        <Card animated delay={0.1} className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Estado de Conexión</h3>
            <StatusIndicator status={connecting ? 'connecting' : connected ? 'online' : 'offline'} size="lg" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status visualization */}
            <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-white/5">
              <motion.div animate={connected ? { scale: [1, 1.05, 1] } : {}} transition={{ repeat: Infinity, duration: 2 }}>
                <ProgressRing progress={connected ? 100 : connecting ? 50 : 0} size={160} strokeWidth={12}
                  color={connected ? 'rgb(var(--success))' : connecting ? 'rgb(var(--warning))' : 'rgb(var(--danger))'}
                  label={connected ? 'Conectado' : connecting ? 'Conectando...' : 'Desconectado'} />
              </motion.div>
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-400">{status?.phone ? `Número: ${status.phone}` : 'Sin número conectado'}</p>
              </div>
            </div>

            {/* Connection info */}
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="w-5 h-5 text-primary-400" />
                  <span className="text-gray-400">Uptime</span>
                </div>
                <p className="text-2xl font-bold text-white">{status?.uptime || formatUptime(uptime)}</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-3 mb-2">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  <span className="text-gray-400">Última actividad</span>
                </div>
                <p className="text-lg font-medium text-white">{status?.lastSeen ? new Date(status.lastSeen).toLocaleString() : 'Sin actividad reciente'}</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-3 mb-2">
                  <Smartphone className="w-5 h-5 text-cyan-400" />
                  <span className="text-gray-400">Estado del sistema</span>
                </div>
                <p className="text-lg font-medium text-white">{connected ? 'Conectado' : 'Desconectado'}</p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-white/10">
            {canControl ? (
              connected ? (
                <>
                  <Button variant="danger" icon={<PowerOff className="w-4 h-4" />} onClick={handleDisconnect}>Desconectar</Button>
                  <Button variant="secondary" icon={<RefreshCw className="w-4 h-4" />} onClick={handleRestart}>Reiniciar</Button>
                </>
              ) : (
                <Button variant="success" icon={<Power className="w-4 h-4" />} onClick={handleConnect} loading={isConnecting}>Conectar Bot</Button>
              )
            ) : (
              <p className="text-sm text-gray-400 [html[data-theme=light]_&]:text-gray-600">
                Solo admins/owner pueden controlar la conexi?n del bot.
              </p>
            )}
          </div>
        </Card>

        {/* Global Control Card */}
        <Card animated delay={0.2} className="p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Control Global</h3>
          <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-white/5 mb-6">
            <motion.div animate={isOn ? { scale: [1, 1.1, 1] } : {}} transition={{ repeat: Infinity, duration: 2 }}
              className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 ${
                isOn ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-glow-emerald' : 'bg-gradient-to-br from-red-500 to-rose-600 shadow-[0_0_20px_rgba(239,68,68,0.5)]'
              }`}>
              {isOn ? <CheckCircle className="w-12 h-12 text-white" /> : <AlertCircle className="w-12 h-12 text-white" />}
            </motion.div>
            <p className="text-xl font-bold text-white mb-2">Bot {isOn ? 'Activo' : 'Inactivo'}</p>
            <p className="text-sm text-gray-400 text-center mb-4">
              {isOn ? 'El bot está respondiendo a todos los grupos' : 'El bot no responderá a ningún mensaje'}
            </p>
            {canControl ? (
              <button onClick={handleGlobalToggle}
                className={`relative w-16 h-8 rounded-full transition-colors ${isOn ? 'bg-emerald-500' : 'bg-gray-600'}`}>
                <motion.div animate={{ x: isOn ? 32 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md" />
              </button>
            ) : (
              <p className="text-xs text-gray-500 [html[data-theme=light]_&]:text-gray-600">Control global solo para admins/owner.</p>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 rounded-xl bg-white/5">
              <span className="text-gray-400 text-sm">Memoria</span>
              <span className="text-white font-medium">
                <AnimatedNumber value={memoryUsage?.systemPercentage || 0} decimals={1} />%
              </span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-white/5">
              <span className="text-gray-400 text-sm">CPU</span>
              <span className="text-white font-medium">
                <AnimatedNumber value={Number(cpuUsage) || 0} />%
              </span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-white/5">
              <span className="text-gray-400 text-sm">Disco</span>
              <span className="text-white font-medium">
                <AnimatedNumber value={diskUsage?.percentage || 0} decimals={1} />%
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* QR / Pairing Section */}
      {!connected && canControl && (
        <Card animated delay={0.3} className="p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Método de Conexión</h3>
          {/* Method selector */}
          <div className="flex gap-4 mb-6">
            <button onClick={() => setAuthMethod('qr')}
              className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                authMethod === 'qr' ? 'border-primary-500 bg-primary-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}>
              <QrCode className={`w-8 h-8 mx-auto mb-2 ${authMethod === 'qr' ? 'text-primary-400' : 'text-gray-400'}`} />
              <p className={`font-medium ${authMethod === 'qr' ? 'text-white' : 'text-gray-400'}`}>Código QR</p>
              <p className="text-xs text-gray-500 mt-1">Escanea con WhatsApp</p>
            </button>
            <button onClick={() => setAuthMethod('pairing')}
              className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                authMethod === 'pairing' ? 'border-primary-500 bg-primary-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}>
              <Smartphone className={`w-8 h-8 mx-auto mb-2 ${authMethod === 'pairing' ? 'text-primary-400' : 'text-gray-400'}`} />
              <p className={`font-medium ${authMethod === 'pairing' ? 'text-white' : 'text-gray-400'}`}>Código de 8 dígitos</p>
              <p className="text-xs text-gray-500 mt-1">Vincula con número</p>
            </button>
          </div>

          {/* QR Code display */}
          <AnimatePresence mode="wait">
            {authMethod === 'qr' && (
              <motion.div key="qr" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center">
                {qrImage ? (
                  <div className="p-4 bg-white rounded-2xl shadow-2xl">
                    <img src={qrImage} alt="QR Code" className="w-64 h-64" />
                  </div>
                ) : (
                  <div className="w-64 h-64 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                    {connecting ? (
                      <Loader2 className="w-12 h-12 text-primary-400 animate-spin" />
                    ) : (
                      <div className="text-center">
                        <QrCode className="w-12 h-12 text-gray-500 mx-auto mb-2" />
                        <p className="text-gray-400 text-sm">Haz clic en &quot;Generar QR&quot; para generar el QR</p>
                      </div>
                    )}
                  </div>
                )}
                <Button variant="primary" className="mt-4" icon={<QrCode className="w-4 h-4" />}
                  onClick={handleConnect} loading={isConnecting}>
                  Generar QR
                </Button>
                <p className="text-sm text-gray-400 mt-4 text-center">
                  Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo
                </p>
              </motion.div>
            )}

            {authMethod === 'pairing' && (
              <motion.div key="pairing" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="max-w-md mx-auto">
	                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-400 mb-2">Número de teléfono (con código de país)</label>
                  <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Ej: 521234567890" className="input-glass w-full" />
                </div>
                {pairingCode && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    className="p-6 rounded-xl bg-gradient-to-br from-primary-500/20 to-violet-500/20 border border-primary-500/30 text-center mb-4">
                    <p className="text-sm text-gray-400 mb-2">Tu código de emparejamiento:</p>
                    <p className="text-4xl font-mono font-bold text-white tracking-widest">{pairingCode}</p>
                    <p className="text-xs text-gray-500 mt-2">Ingresa este código en WhatsApp</p>
                  </motion.div>
                )}
                <Button variant="primary" className="w-full" icon={<Smartphone className="w-4 h-4" />}
                  onClick={handleConnect} loading={isConnecting}>
                  Generar Código
                </Button>
                <p className="text-sm text-gray-400 mt-4 text-center">
                  Abre WhatsApp → Dispositivos vinculados → Vincular con número de teléfono
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      )}

      {/* Stats Grid */}
      <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-4" delay={0.02} stagger={0.07}>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <StatCard
            title="Estado"
            value={connected ? 'Online' : 'Offline'}
            icon={connected ? <Wifi className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />}
            color={connected ? 'success' : 'danger'}
            delay={0}
            animated={false}
          />
        </StaggerItem>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <StatCard
            title="Uptime"
            value={status?.uptime || formatUptime(uptime)}
            icon={<Clock className="w-6 h-6" />}
            color="info"
            delay={0}
            animated={false}
          />
        </StaggerItem>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <StatCard
            title="Memoria"
            value={`${memoryUsage?.systemPercentage || 0}%`}
            icon={<Activity className="w-6 h-6" />}
            color="warning"
            delay={0}
            animated={false}
          />
        </StaggerItem>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <StatCard
            title="Global"
            value={isOn ? 'Activo' : 'Inactivo'}
            icon={isOn ? <CheckCircle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            color={isOn ? 'success' : 'danger'}
            delay={0}
            animated={false}
          />
        </StaggerItem>
      </Stagger>
    </div>
  );
}
