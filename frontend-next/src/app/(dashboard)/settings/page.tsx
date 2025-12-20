'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Save, RefreshCw, Bot, Bell, Shield, Database, Cpu, HardDrive, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SimpleSelect as Select } from '@/components/ui/Select';
import { ProgressRing } from '@/components/ui/Charts';
import { useSystemStats, useBotGlobalState, useBotStatus } from '@/hooks/useRealTime';
import api from '@/services/api';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { memoryUsage, uptime } = useSystemStats(5000);
  const { isOn, setGlobalState } = useBotGlobalState(5000);
  const { isConnected } = useBotStatus(5000);

  const [botConfig, setBotConfig] = useState({
    autoReconnect: true,
    maxReconnectAttempts: 5,
    reconnectInterval: 30,
    logLevel: 'info',
  });

  const [systemConfig, setSystemConfig] = useState({
    maintenanceMode: false,
    debugMode: false,
    apiRateLimit: 100,
    fileUploadLimit: 10,
  });

  const [globalOffMessage, setGlobalOffMessage] = useState('El bot está desactivado globalmente por el administrador.');
  const [saving, setSaving] = useState(false);
  const [systemStats, setSystemStats] = useState<any>(null);

  useEffect(() => { loadConfigs(); }, []);

  const loadConfigs = async () => {
    try {
      const [msgRes, statsRes, botConfigRes] = await Promise.all([
        api.getBotGlobalOffMessage().catch(() => ({ message: '' })),
        api.getSystemStats().catch(() => ({})),
        api.getBotConfig().catch(() => ({}))
      ]);
      
      if (msgRes?.message) setGlobalOffMessage(msgRes.message);
      setSystemStats(statsRes);
      
      // Cargar configuración del bot si existe
      if (botConfigRes) {
        setBotConfig(prev => ({ ...prev, ...botConfigRes }));
      }
      
      // Cargar configuración del sistema si existe
      if (statsRes?.systemConfig) {
        setSystemConfig(prev => ({ ...prev, ...statsRes.systemConfig }));
      }
    } catch (err) {
      console.error('Error loading configs');
    }
  };

  const saveGlobalMessage = async () => {
    setSaving(true);
    try {
      await api.setBotGlobalOffMessage(globalOffMessage);
      toast.success('Mensaje guardado');
    } catch (err) {
      toast.error('Error al guardar mensaje');
    } finally {
      setSaving(false);
    }
  };

  const saveSystemConfig = async () => {
    setSaving(true);
    try {
      await api.updateSystemConfig(systemConfig);
      toast.success('Configuración del sistema guardada');
    } catch (err) {
      toast.error('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const saveBotConfig = async () => {
    setSaving(true);
    try {
      // Guardar configuración real del bot en el backend
      await api.updateBotConfig(botConfig);
      toast.success('Configuración del bot guardada');
    } catch (err) {
      toast.error('Error al guardar configuración del bot');
    } finally {
      setSaving(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-3xl font-bold text-white">Configuración</h1>
          <p className="text-gray-400 mt-1">Administra la configuración del sistema y el bot</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <Button variant="secondary" icon={<RefreshCw className="w-4 h-4" />} onClick={loadConfigs}>Recargar</Button>
        </motion.div>
      </div>

      {/* System Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Uptime" value={formatUptime(uptime)} icon={<Clock className="w-6 h-6" />} color="primary" delay={0} />
        <StatCard title="Memoria" value={`${memoryUsage?.systemPercentage || 0}%`} icon={<Cpu className="w-6 h-6" />} color="info" delay={0.1} />
        <StatCard title="Plataforma" value={systemStats?.platform || 'N/A'} icon={<HardDrive className="w-6 h-6" />} color="violet" delay={0.2} />
        <StatCard title="Node.js" value={systemStats?.node || 'N/A'} icon={<Database className="w-6 h-6" />} color="success" delay={0.3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bot Global Control */}
        <Card animated delay={0.2} className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary-500/20 text-primary-400"><Bot className="w-5 h-5" /></div>
            <h2 className="text-lg font-semibold text-white">Control Global del Bot</h2>
          </div>
          <div className="flex items-center justify-center mb-6">
            <motion.div animate={isOn ? { scale: [1, 1.05, 1] } : {}} transition={{ repeat: Infinity, duration: 2 }}>
              <ProgressRing progress={isOn ? 100 : 0} size={140} color={isOn ? '#10b981' : '#ef4444'} label={isOn ? 'Activo' : 'Inactivo'} />
            </motion.div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
              <div>
                <p className="font-medium text-white">Estado Global</p>
                <p className="text-sm text-gray-400">Activa o desactiva el bot en todos los grupos</p>
              </div>
              <button onClick={() => setGlobalState(!isOn)}
                className={`relative w-14 h-7 rounded-full transition-colors ${isOn ? 'bg-emerald-500' : 'bg-gray-600'}`}>
                <motion.div animate={{ x: isOn ? 28 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md" />
              </button>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
              <div>
                <p className="font-medium text-white">Conexión</p>
                <p className="text-sm text-gray-400">Estado de conexión con WhatsApp</p>
              </div>
              <span className={`badge ${isConnected ? 'badge-success' : 'badge-danger'}`}>
                {isConnected ? <CheckCircle className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}
                {isConnected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
          </div>
        </Card>

        {/* Global Off Message */}
        <Card animated delay={0.3} className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400"><Bell className="w-5 h-5" /></div>
            <h2 className="text-lg font-semibold text-white">Mensaje de Bot Desactivado</h2>
          </div>
          <p className="text-sm text-gray-400 mb-4">Este mensaje se enviará cuando el bot esté desactivado globalmente</p>
          <textarea value={globalOffMessage} onChange={(e) => setGlobalOffMessage(e.target.value)}
            className="input-glass w-full h-32 resize-none mb-4" placeholder="Mensaje cuando el bot está desactivado..." />
          <Button variant="primary" className="w-full" icon={<Save className="w-4 h-4" />} onClick={saveGlobalMessage} loading={saving}>
            Guardar Mensaje
          </Button>
        </Card>

        {/* Bot Configuration */}
        <Card animated delay={0.4} className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400"><SettingsIcon className="w-5 h-5" /></div>
            <h2 className="text-lg font-semibold text-white">Configuración del Bot</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Auto Reconexión</p>
                <p className="text-xs text-gray-500">Reconectar automáticamente si se pierde la conexión</p>
              </div>
              <button onClick={() => setBotConfig({ ...botConfig, autoReconnect: !botConfig.autoReconnect })}
                className={`relative w-14 h-7 rounded-full transition-colors ${botConfig.autoReconnect ? 'bg-emerald-500' : 'bg-gray-600'}`}>
                <motion.div animate={{ x: botConfig.autoReconnect ? 28 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Intentos de Reconexión</label>
              <input type="number" value={botConfig.maxReconnectAttempts}
                onChange={(e) => setBotConfig({ ...botConfig, maxReconnectAttempts: parseInt(e.target.value) })}
                className="input-glass w-full" min={1} max={20} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Intervalo de Reconexión (seg)</label>
              <input type="number" value={botConfig.reconnectInterval}
                onChange={(e) => setBotConfig({ ...botConfig, reconnectInterval: parseInt(e.target.value) })}
                className="input-glass w-full" min={5} max={300} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Nivel de Log</label>
              <Select value={botConfig.logLevel} onChange={(value) => setBotConfig({ ...botConfig, logLevel: value })} options={[
                { value: 'error', label: 'Error' },
                { value: 'warn', label: 'Warning' },
                { value: 'info', label: 'Info' },
                { value: 'debug', label: 'Debug' }
              ]} />
            </div>
            <Button variant="primary" className="w-full" icon={<Save className="w-4 h-4" />} onClick={saveBotConfig} loading={saving}>
              Guardar Configuración del Bot
            </Button>
          </div>
        </Card>

        {/* System Configuration */}
        <Card animated delay={0.5} className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-violet-500/20 text-violet-400"><Shield className="w-5 h-5" /></div>
            <h2 className="text-lg font-semibold text-white">Configuración del Sistema</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Modo Mantenimiento</p>
                <p className="text-xs text-gray-500">Desactiva el acceso al panel temporalmente</p>
              </div>
              <button onClick={() => setSystemConfig({ ...systemConfig, maintenanceMode: !systemConfig.maintenanceMode })}
                className={`relative w-14 h-7 rounded-full transition-colors ${systemConfig.maintenanceMode ? 'bg-emerald-500' : 'bg-gray-600'}`}>
                <motion.div animate={{ x: systemConfig.maintenanceMode ? 28 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md" />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Modo Debug</p>
                <p className="text-xs text-gray-500">Habilita logs detallados para depuración</p>
              </div>
              <button onClick={() => setSystemConfig({ ...systemConfig, debugMode: !systemConfig.debugMode })}
                className={`relative w-14 h-7 rounded-full transition-colors ${systemConfig.debugMode ? 'bg-emerald-500' : 'bg-gray-600'}`}>
                <motion.div animate={{ x: systemConfig.debugMode ? 28 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Límite de API (req/min)</label>
              <input type="number" value={systemConfig.apiRateLimit}
                onChange={(e) => setSystemConfig({ ...systemConfig, apiRateLimit: parseInt(e.target.value) })}
                className="input-glass w-full" min={10} max={1000} />
            </div>
            <Button variant="primary" className="w-full" icon={<Save className="w-4 h-4" />} onClick={saveSystemConfig} loading={saving}>
              Guardar Configuración
            </Button>
          </div>
        </Card>
      </div>

      {/* System Info */}
      <Card animated delay={0.6} className="p-6">
        <h2 className="text-lg font-semibold text-white mb-6">Información del Sistema</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white/5">
            <p className="text-xs text-gray-500 mb-1">CPU</p>
            <p className="text-white font-medium truncate">{systemStats?.cpu || 'N/A'}</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5">
            <p className="text-xs text-gray-500 mb-1">Memoria Total</p>
            <p className="text-white font-medium">{formatBytes(systemStats?.memory?.total || 0)}</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5">
            <p className="text-xs text-gray-500 mb-1">Memoria Libre</p>
            <p className="text-white font-medium">{formatBytes(systemStats?.memory?.free || 0)}</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5">
            <p className="text-xs text-gray-500 mb-1">Heap Usado</p>
            <p className="text-white font-medium">{formatBytes(systemStats?.memory?.heapUsed || 0)}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
