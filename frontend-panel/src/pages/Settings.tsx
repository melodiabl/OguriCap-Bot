import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon,
  Save,
  RefreshCw,
  Bot,
  Bell,
  Shield,
  Database,
  Cpu,
  HardDrive,
  Clock,
  AlertCircle,
  CheckCircle,
  Key,
} from 'lucide-react';
import { AnimatedCard, StatCard } from '../components/ui/AnimatedCard';
import { AnimatedButton, ToggleButton } from '../components/ui/AnimatedButton';
import { ProgressRing } from '../components/ui/Charts';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { CustomSelect } from '../components/ui/CustomSelect';
import { useSystemStats, useGlobalBotState, useBotStatus } from '../hooks/useRealTime';
import toast from 'react-hot-toast';
import api from '../config/api';

const Settings: React.FC = () => {
  const { stats: systemStats, memoryUsage, uptime } = useSystemStats(5000);
  const { isOn, setGlobalState } = useGlobalBotState(5000);
  const { isConnected } = useBotStatus(5000);

  const [botConfig, setBotConfig] = useState({
    autoReconnect: true,
    maxReconnectAttempts: 5,
    reconnectInterval: 30,
    logLevel: 'info',
    qrTimeout: 60,
    sessionTimeout: 3600,
  });

  const [systemConfig, setSystemConfig] = useState({
    maintenanceMode: false,
    debugMode: false,
    apiRateLimit: 100,
    fileUploadLimit: 10,
  });

  const [globalOffMessage, setGlobalOffMessage] = useState('El bot está desactivado globalmente por el administrador.');
  const [saving, setSaving] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const [botRes, msgRes] = await Promise.all([
        api.get('/api/bot/config').catch(() => ({ data: {} })),
        api.get('/api/bot/global-off-message').catch(() => ({ data: { message: '' } })),
      ]);
      if (botRes.data) setBotConfig(prev => ({ ...prev, ...botRes.data }));
      if (msgRes.data?.message) setGlobalOffMessage(msgRes.data.message);
    } catch (err) {
      console.error('Error loading configs');
    }
  };

  const saveBotConfig = async () => {
    setSaving(true);
    try {
      await api.patch('/api/bot/config', botConfig);
      toast.success('Configuración del bot guardada');
    } catch (err) {
      toast.error('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const saveSystemConfig = async () => {
    setSaving(true);
    try {
      await api.patch('/api/system/config', systemConfig);
      toast.success('Configuración del sistema guardada');
    } catch (err) {
      toast.error('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const saveGlobalMessage = async () => {
    setSaving(true);
    try {
      await api.post('/api/bot/global-off-message', { message: globalOffMessage });
      toast.success('Mensaje guardado');
    } catch (err) {
      toast.error('Error al guardar mensaje');
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
          <AnimatedButton variant="secondary" icon={<RefreshCw className="w-4 h-4" />} onClick={loadConfigs}>
            Recargar
          </AnimatedButton>
        </motion.div>
      </div>

      {/* System Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Uptime"
          value={formatUptime(uptime)}
          icon={<Clock className="w-6 h-6" />}
          color="primary"
          delay={0}
        />
        <StatCard
          title="Memoria"
          value={`${memoryUsage?.systemPercentage || 0}%`}
          icon={<Cpu className="w-6 h-6" />}
          color="info"
          delay={0.1}
        />
        <StatCard
          title="Plataforma"
          value={systemStats?.platform || 'N/A'}
          icon={<HardDrive className="w-6 h-6" />}
          color="violet"
          delay={0.2}
        />
        <StatCard
          title="Node.js"
          value={systemStats?.node || 'N/A'}
          icon={<Database className="w-6 h-6" />}
          color="success"
          delay={0.3}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bot Global Control */}
        <AnimatedCard delay={0.2} className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary-500/20 text-primary-400">
              <Bot className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-white">Control Global del Bot</h2>
          </div>

          <div className="flex items-center justify-center mb-6">
            <motion.div
              animate={isOn ? { scale: [1, 1.05, 1] } : {}}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <ProgressRing
                progress={isOn ? 100 : 0}
                size={140}
                color={isOn ? '#10b981' : '#ef4444'}
                label={isOn ? 'Activo' : 'Inactivo'}
              />
            </motion.div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
              <div>
                <p className="font-medium text-white">Estado Global</p>
                <p className="text-sm text-gray-400">Activa o desactiva el bot en todos los grupos</p>
              </div>
              <ToggleButton isOn={isOn} onToggle={() => setGlobalState(!isOn)} size="lg" />
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
        </AnimatedCard>

        {/* Global Off Message */}
        <AnimatedCard delay={0.3} className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
              <Bell className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-white">Mensaje de Bot Desactivado</h2>
          </div>

          <p className="text-sm text-gray-400 mb-4">
            Este mensaje se enviará cuando el bot esté desactivado globalmente
          </p>

          <textarea
            value={globalOffMessage}
            onChange={(e) => setGlobalOffMessage(e.target.value)}
            className="input-glass w-full h-32 resize-none mb-4"
            placeholder="Mensaje cuando el bot está desactivado..."
          />

          <AnimatedButton
            variant="primary"
            fullWidth
            icon={<Save className="w-4 h-4" />}
            onClick={saveGlobalMessage}
            loading={saving}
          >
            Guardar Mensaje
          </AnimatedButton>
        </AnimatedCard>

        {/* Bot Configuration */}
        <AnimatedCard delay={0.4} className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-white">Configuración del Bot</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Auto Reconexión</p>
                <p className="text-xs text-gray-500">Reconectar automáticamente si se pierde la conexión</p>
              </div>
              <ToggleButton
                isOn={botConfig.autoReconnect}
                onToggle={() => setBotConfig({ ...botConfig, autoReconnect: !botConfig.autoReconnect })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Intentos de Reconexión</label>
              <input
                type="number"
                value={botConfig.maxReconnectAttempts}
                onChange={(e) => setBotConfig({ ...botConfig, maxReconnectAttempts: parseInt(e.target.value) })}
                className="input-glass w-full"
                min={1}
                max={20}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Intervalo de Reconexión (seg)</label>
              <input
                type="number"
                value={botConfig.reconnectInterval}
                onChange={(e) => setBotConfig({ ...botConfig, reconnectInterval: parseInt(e.target.value) })}
                className="input-glass w-full"
                min={5}
                max={300}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Nivel de Log</label>
              <CustomSelect
                value={botConfig.logLevel}
                onChange={(value) => setBotConfig({ ...botConfig, logLevel: value })}
                options={[
                  { value: 'error', label: 'Error' },
                  { value: 'warn', label: 'Warning' },
                  { value: 'info', label: 'Info' },
                  { value: 'debug', label: 'Debug' }
                ]}
                placeholder="Seleccionar nivel"
              />
            </div>

            <AnimatedButton
              variant="primary"
              fullWidth
              icon={<Save className="w-4 h-4" />}
              onClick={saveBotConfig}
              loading={saving}
            >
              Guardar Configuración
            </AnimatedButton>
          </div>
        </AnimatedCard>

        {/* System Configuration */}
        <AnimatedCard delay={0.5} className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-violet-500/20 text-violet-400">
              <Shield className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-white">Configuración del Sistema</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Modo Mantenimiento</p>
                <p className="text-xs text-gray-500">Desactiva el acceso al panel temporalmente</p>
              </div>
              <ToggleButton
                isOn={systemConfig.maintenanceMode}
                onToggle={() => setSystemConfig({ ...systemConfig, maintenanceMode: !systemConfig.maintenanceMode })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Modo Debug</p>
                <p className="text-xs text-gray-500">Habilita logs detallados para depuración</p>
              </div>
              <ToggleButton
                isOn={systemConfig.debugMode}
                onToggle={() => setSystemConfig({ ...systemConfig, debugMode: !systemConfig.debugMode })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Límite de API (req/min)</label>
              <input
                type="number"
                value={systemConfig.apiRateLimit}
                onChange={(e) => setSystemConfig({ ...systemConfig, apiRateLimit: parseInt(e.target.value) })}
                className="input-glass w-full"
                min={10}
                max={1000}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Límite de Archivos (MB)</label>
              <input
                type="number"
                value={systemConfig.fileUploadLimit}
                onChange={(e) => setSystemConfig({ ...systemConfig, fileUploadLimit: parseInt(e.target.value) })}
                className="input-glass w-full"
                min={1}
                max={100}
              />
            </div>

            <AnimatedButton
              variant="primary"
              fullWidth
              icon={<Save className="w-4 h-4" />}
              onClick={saveSystemConfig}
              loading={saving}
            >
              Guardar Configuración
            </AnimatedButton>
          </div>
        </AnimatedCard>
      </div>

      {/* System Info */}
      <AnimatedCard delay={0.6} className="p-6">
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
      </AnimatedCard>

      {/* Security Settings */}
      <AnimatedCard delay={0.6} className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
            <Shield className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-semibold text-white">Seguridad</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
            <div>
              <p className="font-medium text-white">Cambiar Contraseña</p>
              <p className="text-sm text-gray-400">Actualiza tu contraseña de acceso al panel</p>
            </div>
            <AnimatedButton
              variant="secondary"
              icon={<Key className="w-4 h-4" />}
              onClick={() => setShowChangePassword(true)}
            >
              Cambiar
            </AnimatedButton>
          </div>
        </div>
      </AnimatedCard>

      {/* Change Password Modal */}
      <ChangePasswordModal 
        isOpen={showChangePassword} 
        onClose={() => setShowChangePassword(false)} 
      />
    </div>
  );
};

export default Settings;
