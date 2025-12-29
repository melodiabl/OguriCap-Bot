'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings, 
  Save, 
  RotateCcw, 
  Download, 
  Upload, 
  History, 
  Eye, 
  EyeOff,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Copy,
  Edit,
  Trash2,
  Plus,
  RefreshCw,
  FileText,
  Database,
  Shield,
  Bell,
  Bot,
  Zap,
  Cpu,
  HardDrive,
  Clock,
  AlertCircle,
  Wrench
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, StatCard } from '@/components/ui/Card';
import { SimpleSelect as Select } from '@/components/ui/Select';
import { ProgressRing } from '@/components/ui/Charts';
import { useSocket } from '@/hooks/useSocket';
import { useSystemStats, useBotStatus } from '@/hooks/useRealTime';
import { useBotGlobalState as useBotGlobalStateContext } from '@/contexts/BotGlobalStateContext';
import { useGlobalUpdate } from '@/contexts/GlobalUpdateContext';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import api from '@/services/api';
import toast from 'react-hot-toast';

interface ConfigSection {
  key: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  data: any;
}

interface ConfigVersion {
  id: string;
  timestamp: string;
  userId: string;
  state: string;
  checksum: string;
}

interface ConfigStats {
  totalConfigurations: number;
  currentEnvironment: string;
  totalVersions: number;
  totalBackups: number;
  lastUpdate: string;
}

export default function ConfiguracionPage() {
  const searchParams = useSearchParams();
  const { memoryUsage, uptime } = useSystemStats(5000);
  const { isConnected } = useBotStatus(5000);
  
  // Bot Global State Context
  const { isGloballyOn: contextGlobalState, setGlobalState: contextSetGlobalState } = useBotGlobalStateContext();
  const { systemStats, refreshAll } = useGlobalUpdate();

  // Auto-refresh - DISABLED to prevent resource exhaustion
  // useAutoRefresh(refreshAll, { interval: 30000 });

  const [configurations, setConfigurations] = useState<ConfigSection[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<string>('main');
  const [configData, setConfigData] = useState<any>({});
  const [originalData, setOriginalData] = useState<any>({});
  const [versions, setVersions] = useState<ConfigVersion[]>([]);
  const [stats, setStats] = useState<ConfigStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Advanced configuration states
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
    adminIPs: [],
    allowLocalhost: true,
    currentIP: '',
  });

  const [globalOffMessage, setGlobalOffMessage] = useState('El bot está desactivado globalmente por el administrador.');

  const socket = useSocket();

  useEffect(() => {
    loadConfigurations();
    loadStats();
    loadAdvancedConfigs();
    
    // Manejar parámetro de sección de URL
    const section = searchParams.get('section');
    if (section) {
      setSelectedConfig(section);
    }
  }, []); // Only run once on mount

  useEffect(() => {
    if (selectedConfig) {
      loadConfiguration(selectedConfig);
      loadVersionHistory(selectedConfig);
    }
  }, [selectedConfig]);

  useEffect(() => {
    // Detectar cambios
    const hasChanges = JSON.stringify(configData) !== JSON.stringify(originalData);
    setHasChanges(hasChanges);
  }, [configData, originalData]);

  useEffect(() => {
    if (!socket) return;

    const handleConfigUpdate = (data: any) => {
      if (data?.configKey === 'main') {
        loadConfiguration(selectedConfig);
        loadVersionHistory(selectedConfig);
        toast.success('Configuración actualizada por otro usuario');
      }
    };

    socket.on('config:updated', handleConfigUpdate);

    return () => {
      socket.off('config:updated', handleConfigUpdate);
    };
  }, [socket, selectedConfig]);

  const loadConfigurations = async () => {
    try {
      setIsLoading(true);
      const data = await api.getConfig('main');
      
      const configSections: ConfigSection[] = [
        {
          key: 'main',
          name: 'Configuración Principal',
          description: 'Configuración general del sistema',
          icon: Settings,
          color: 'blue',
          data: data || {}
        },
        {
          key: 'system',
          name: 'Sistema',
          description: 'Configuración del sistema y recursos',
          icon: Database,
          color: 'green',
          data: (data as any)?.system || {}
        },
        {
          key: 'bot',
          name: 'Bot',
          description: 'Configuración del bot de WhatsApp',
          icon: Bot,
          color: 'purple',
          data: (data as any)?.bot || {}
        },
        {
          key: 'security',
          name: 'Seguridad',
          description: 'Configuración de seguridad y autenticación',
          icon: Shield,
          color: 'red',
          data: (data as any)?.security || {}
        },
        {
          key: 'notifications',
          name: 'Notificaciones',
          description: 'Configuración de notificaciones y alertas',
          icon: Bell,
          color: 'yellow',
          data: (data as any)?.notifications || {}
        }
      ];
      
      setConfigurations(configSections);
    } catch (error) {
      console.error('Error loading configurations:', error);
      toast.error('Error cargando configuraciones');
    } finally {
      setIsLoading(false);
    }
  };

  const loadConfiguration = async (key: string) => {
    try {
      const main = await api.getConfig('main');
      const sectionData = key === 'main' ? (main || {}) : ((main as any)?.[key] || {});
      setConfigData(sectionData || {});
      setOriginalData(JSON.parse(JSON.stringify(sectionData || {})));
      setValidationErrors([]);
    } catch (error) {
      console.error('Error loading configuration:', error);
      toast.error('Error cargando configuración');
    }
  };

  const loadVersionHistory = async (key: string) => {
    try {
      const res = await api.getConfigVersions('main', 50).catch(() => ({} as any));
      const list = (res as any)?.versions || [];
      setVersions(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Error loading version history:', error);
    }
  };

  const loadStats = async () => {
    try {
      const [configStats, backupsRes] = await Promise.all([
        api.getConfigStats().catch(() => ({} as any)),
        api.getBackups().catch(() => ({} as any))
      ]);

      const backupsList =
        (backupsRes as any)?.backups ||
        (backupsRes as any)?.data?.backups ||
        (backupsRes as any)?.reports ||
        (backupsRes as any)?.items ||
        [];

      const totalBackups = Array.isArray(backupsList) ? backupsList.length : (Number((backupsRes as any)?.count) || 0);

      setStats({
        totalConfigurations: Number((configStats as any)?.totalConfigurations) || configurations.length,
        currentEnvironment: (configStats as any)?.currentEnvironment || 'unknown',
        totalVersions: Number((configStats as any)?.totalVersions) || 0,
        totalBackups,
        lastUpdate: (configStats as any)?.lastUpdate || ''
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadAdvancedConfigs = async () => {
    try {
      const [msgRes, botConfigRes, systemConfigRes] = await Promise.all([
        api.getBotGlobalOffMessage().catch(() => ({ message: '' })),
        api.getBotConfig().catch(() => ({})),
        api.getSystemConfig().catch(() => ({}))
      ]);
      
      if (msgRes?.message) setGlobalOffMessage(msgRes.message);
      
      if (systemConfigRes) {
        setSystemConfig(prev => ({ ...prev, ...systemConfigRes }));
      }
      
      if (botConfigRes) {
        setBotConfig(prev => ({ ...prev, ...botConfigRes }));
      }
    } catch (err) {
      console.error('Error loading advanced configs');
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
      const { currentIP, ...payload } = systemConfig as any;
      await api.updateSystemConfig(payload);
      toast.success('Configuración del sistema guardada');
    } catch (err) {
      toast.error('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const toggleMaintenanceMode = async () => {
    const next = !systemConfig.maintenanceMode;
    setSystemConfig(prev => ({ ...prev, maintenanceMode: next }));
    setSaving(true);
    try {
      await api.updateSystemConfig({ maintenanceMode: next });
      toast.success(next ? 'Modo mantenimiento activado' : 'Modo mantenimiento desactivado');
    } catch (err) {
      setSystemConfig(prev => ({ ...prev, maintenanceMode: !next }));
      toast.error('No se pudo aplicar modo mantenimiento');
    } finally {
      setSaving(false);
    }
  };

  const saveBotConfig = async () => {
    setSaving(true);
    try {
      await api.updateBotConfig(botConfig);
      toast.success('Configuración del bot guardada');
    } catch (err) {
      toast.error('Error al guardar configuración del bot');
    } finally {
      setSaving(false);
    }
  };

  const addCurrentIP = async () => {
    setSaving(true);
    try {
      const result = await api.addCurrentIPAsAdmin();
      toast.success(`IP ${result.addedIP} agregada como administrador`);
      loadAdvancedConfigs();
    } catch (err) {
      toast.error('Error al agregar IP');
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

  const saveConfiguration = async () => {
    try {
      setSaving(true);
      
      const currentMain = await api.getConfig('main').catch(() => ({} as any));
      const nextMain =
        selectedConfig === 'main'
          ? configData
          : { ...(currentMain || {}), [selectedConfig]: configData };

      await api.updateConfig('main', nextMain);
      setOriginalData(JSON.parse(JSON.stringify(configData)));
      setHasChanges(false);
      toast.success('Configuración guardada exitosamente');
      
      // Recargar versiones
      loadVersionHistory(selectedConfig);
      loadStats();
    } catch (error: any) {
      console.error('Error saving configuration:', error);
      const validation = error?.response?.data?.validationErrors;
      if (Array.isArray(validation) && validation.length) {
        setValidationErrors(validation);
        toast.error('Validación fallida');
      } else {
        toast.error('Error guardando configuración');
      }
    } finally {
      setSaving(false);
    }
  };

  const rollbackToVersion = async (versionId: string) => {
    if (!confirm('¿Estás seguro de que quieres hacer rollback a esta versión?')) return;

    try {
      await api.rollbackConfig('main', versionId);
      toast.success('Rollback realizado exitosamente');
      loadConfiguration(selectedConfig);
      loadVersionHistory(selectedConfig);
    } catch (error) {
      toast.error('Error realizando rollback');
    }
  };

  const exportConfiguration = async () => {
    try {
      const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `config-${selectedConfig}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Configuración exportada');
    } catch (error) {
      toast.error('Error exportando configuración');
    }
  };

  const importConfiguration = async (file: File) => {
    try {
      const text = await file.text();
      const importedConfig = JSON.parse(text);
      
      setConfigData(importedConfig);
      toast.success('Configuración importada exitosamente');
      loadVersionHistory(selectedConfig);
    } catch (error) {
      toast.error('Error procesando archivo de configuración');
    }
  };

  const resetConfiguration = () => {
    if (!confirm('¿Estás seguro de que quieres descartar todos los cambios?')) return;
    
    setConfigData(JSON.parse(JSON.stringify(originalData)));
    setValidationErrors([]);
    setHasChanges(false);
    toast.success('Cambios descartados');
  };

  const updateConfigValue = (path: string, value: any) => {
    const newConfig = { ...configData };
    const keys = path.split('.');
    let current = newConfig;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    setConfigData(newConfig);
  };

  const getConfigValue = (path: string) => {
    const keys = path.split('.');
    let current = configData;
    
    for (const key of keys) {
      if (current && typeof current === 'object') {
        current = current[key];
      } else {
        return undefined;
      }
    }
    
    return current;
  };

  const renderConfigEditor = () => {
    if (showJsonEditor) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Editor JSON</h3>
            <Button
              onClick={() => setShowJsonEditor(false)}
              variant="secondary"
              size="sm"
            >
              <Eye className="w-4 h-4 mr-2" />
              Vista Normal
            </Button>
          </div>
          
          <textarea
            value={JSON.stringify(configData, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                setConfigData(parsed);
                setValidationErrors([]);
              } catch (error) {
                setValidationErrors(['JSON inválido']);
              }
            }}
            className="w-full h-96 p-4 bg-gray-900 border border-gray-700 rounded-lg text-white font-mono text-sm"
            placeholder="Configuración en formato JSON..."
          />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {selectedConfig === 'main' && renderMainConfigEditor()}
        {selectedConfig === 'system' && renderSystemConfigEditor()}
        {selectedConfig === 'bot' && renderBotConfigEditor()}
        {selectedConfig === 'security' && renderSecurityConfigEditor()}
        {selectedConfig === 'notifications' && renderNotificationsConfigEditor()}
      </div>
    );
  };

  const renderMainConfigEditor = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Información General</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Versión
          </label>
          <input
            type="text"
            value={getConfigValue('version') || ''}
            onChange={(e) => updateConfigValue('version', e.target.value)}
            className="input-glass"
            placeholder="1.0.0"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Ambiente
          </label>
          <select
            value={getConfigValue('environment') || ''}
            onChange={(e) => updateConfigValue('environment', e.target.value)}
            className="input-glass"
          >
            <option value="development">Desarrollo</option>
            <option value="staging">Staging</option>
            <option value="production">Producción</option>
            <option value="testing">Testing</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderSystemConfigEditor = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Configuración del Sistema</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Nombre del Sistema
          </label>
          <input
            type="text"
            value={getConfigValue('name') || ''}
            onChange={(e) => updateConfigValue('name', e.target.value)}
            className="input-glass"
            placeholder="WhatsApp Bot Panel"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Memoria Máxima
          </label>
          <input
            type="text"
            value={getConfigValue('maxMemory') || ''}
            onChange={(e) => updateConfigValue('maxMemory', e.target.value)}
            className="input-glass"
            placeholder="512MB"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Nivel de Log
          </label>
          <select
            value={getConfigValue('logLevel') || ''}
            onChange={(e) => updateConfigValue('logLevel', e.target.value)}
            className="input-glass"
          >
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="debug"
            checked={getConfigValue('debug') || false}
            onChange={(e) => updateConfigValue('debug', e.target.checked)}
            className="rounded border-gray-600 bg-gray-700 text-primary-500"
          />
          <label htmlFor="debug" className="text-sm text-gray-300">
            Modo Debug
          </label>
        </div>
      </div>
    </div>
  );

  const renderBotConfigEditor = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Configuración del Bot</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Nombre del Bot
          </label>
          <input
            type="text"
            value={getConfigValue('name') || ''}
            onChange={(e) => updateConfigValue('name', e.target.value)}
            className="input-glass"
            placeholder="Oguri Bot"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Prefijo de Comandos
          </label>
          <input
            type="text"
            value={getConfigValue('prefix') || ''}
            onChange={(e) => updateConfigValue('prefix', e.target.value)}
            className="input-glass"
            placeholder="#"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Cooldown de Comandos (ms)
          </label>
          <input
            type="number"
            value={getConfigValue('commandCooldown') || ''}
            onChange={(e) => updateConfigValue('commandCooldown', parseInt(e.target.value))}
            className="input-glass"
            placeholder="3000"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Máximo de Reintentos
          </label>
          <input
            type="number"
            value={getConfigValue('maxRetries') || ''}
            onChange={(e) => updateConfigValue('maxRetries', parseInt(e.target.value))}
            className="input-glass"
            placeholder="5"
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoReconnect"
              checked={getConfigValue('autoReconnect') || false}
              onChange={(e) => updateConfigValue('autoReconnect', e.target.checked)}
              className="rounded border-gray-600 bg-gray-700 text-primary-500"
            />
            <label htmlFor="autoReconnect" className="text-sm text-gray-300">
              Reconexión Automática
            </label>
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="globallyEnabled"
              checked={getConfigValue('globallyEnabled') || false}
              onChange={(e) => updateConfigValue('globallyEnabled', e.target.checked)}
              className="rounded border-gray-600 bg-gray-700 text-primary-500"
            />
            <label htmlFor="globallyEnabled" className="text-sm text-gray-300">
              Habilitado Globalmente
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSecurityConfigEditor = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Configuración de Seguridad</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Requests por Minuto
          </label>
          <input
            type="number"
            value={getConfigValue('maxRequestsPerMinute') || ''}
            onChange={(e) => updateConfigValue('maxRequestsPerMinute', parseInt(e.target.value))}
            className="input-glass"
            placeholder="100"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Timeout de Sesión (ms)
          </label>
          <input
            type="number"
            value={getConfigValue('sessionTimeout') || ''}
            onChange={(e) => updateConfigValue('sessionTimeout', parseInt(e.target.value))}
            className="input-glass"
            placeholder="86400000"
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enableRateLimit"
              checked={getConfigValue('enableRateLimit') || false}
              onChange={(e) => updateConfigValue('enableRateLimit', e.target.checked)}
              className="rounded border-gray-600 bg-gray-700 text-primary-500"
            />
            <label htmlFor="enableRateLimit" className="text-sm text-gray-300">
              Habilitar Rate Limiting
            </label>
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enableIPBlocking"
              checked={getConfigValue('enableIPBlocking') || false}
              onChange={(e) => updateConfigValue('enableIPBlocking', e.target.checked)}
              className="rounded border-gray-600 bg-gray-700 text-primary-500"
            />
            <label htmlFor="enableIPBlocking" className="text-sm text-gray-300">
              Habilitar Bloqueo de IPs
            </label>
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enableAuditLog"
              checked={getConfigValue('enableAuditLog') || false}
              onChange={(e) => updateConfigValue('enableAuditLog', e.target.checked)}
              className="rounded border-gray-600 bg-gray-700 text-primary-500"
            />
            <label htmlFor="enableAuditLog" className="text-sm text-gray-300">
              Habilitar Log de Auditoría
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderNotificationsConfigEditor = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white">Configuración de Notificaciones</h3>
      
      {/* Email */}
      <div className="glass-card p-4">
        <h4 className="font-medium text-white mb-4">Email</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="emailEnabled"
              checked={getConfigValue('email.enabled') || false}
              onChange={(e) => updateConfigValue('email.enabled', e.target.checked)}
              className="rounded border-gray-600 bg-gray-700 text-primary-500"
            />
            <label htmlFor="emailEnabled" className="text-sm text-gray-300">
              Habilitar Email
            </label>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Host SMTP
            </label>
            <input
              type="text"
              value={getConfigValue('email.smtp.host') || ''}
              onChange={(e) => updateConfigValue('email.smtp.host', e.target.value)}
              className="input-glass"
              placeholder="smtp.gmail.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Puerto SMTP
            </label>
            <input
              type="number"
              value={getConfigValue('email.smtp.port') || ''}
              onChange={(e) => updateConfigValue('email.smtp.port', parseInt(e.target.value))}
              className="input-glass"
              placeholder="587"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="smtpSecure"
              checked={getConfigValue('email.smtp.secure') || false}
              onChange={(e) => updateConfigValue('email.smtp.secure', e.target.checked)}
              className="rounded border-gray-600 bg-gray-700 text-primary-500"
            />
            <label htmlFor="smtpSecure" className="text-sm text-gray-300">
              Conexión Segura
            </label>
          </div>
        </div>
      </div>
      
      {/* WhatsApp */}
      <div className="glass-card p-4">
        <h4 className="font-medium text-white mb-4">WhatsApp</h4>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="whatsappEnabled"
              checked={getConfigValue('whatsapp.enabled') || false}
              onChange={(e) => updateConfigValue('whatsapp.enabled', e.target.checked)}
              className="rounded border-gray-600 bg-gray-700 text-primary-500"
            />
            <label htmlFor="whatsappEnabled" className="text-sm text-gray-300">
              Habilitar WhatsApp
            </label>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Números de Admin (separados por coma)
            </label>
            <input
              type="text"
              value={(getConfigValue('whatsapp.adminNumbers') || []).join(', ')}
              onChange={(e) => updateConfigValue('whatsapp.adminNumbers', e.target.value.split(',').map(n => n.trim()))}
              className="input-glass"
              placeholder="1234567890, 0987654321"
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Configuración</h1>
          <p className="text-gray-400">Administra la configuración del sistema y el bot</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowVersions(!showVersions)}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <History className="w-4 h-4" />
            {showVersions ? 'Ocultar' : 'Ver'} Historial
          </Button>
          
          <Button
            onClick={exportConfiguration}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar
          </Button>
          
          <label className="cursor-pointer">
            <input
              id="import-input"
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importConfiguration(file);
              }}
              className="hidden"
            />
            <Button
              variant="secondary"
              className="flex items-center gap-2"
              onClick={() => document.getElementById('import-input')?.click()}
            >
              <Upload className="w-4 h-4" />
              Importar
            </Button>
          </label>
        </div>
      </div>

      {/* System Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Uptime" value={formatUptime(uptime)} icon={<Clock className="w-6 h-6" />} color="primary" delay={0} />
        <StatCard title="Memoria" value={`${memoryUsage?.systemPercentage || 0}%`} icon={<Cpu className="w-6 h-6" />} color="info" delay={0.1} />
        <StatCard title="Plataforma" value={systemStats?.platform || 'N/A'} icon={<HardDrive className="w-6 h-6" />} color="violet" delay={0.2} />
        <StatCard title="Node.js" value={systemStats?.node || 'N/A'} icon={<Database className="w-6 h-6" />} color="success" delay={0.3} />
      </div>

      {/* Advanced Configuration Sections */}
      {selectedConfig === 'main' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bot Global Control */}
          <Card animated delay={0.2} className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-primary-500/20 text-primary-400"><Bot className="w-5 h-5" /></div>
              <h2 className="text-lg font-semibold text-white">Control Global del Bot</h2>
            </div>
            <div className="flex items-center justify-center mb-6">
              <motion.div animate={contextGlobalState ? { scale: [1, 1.05, 1] } : {}} transition={{ repeat: Infinity, duration: 2 }}>
                <ProgressRing progress={contextGlobalState ? 100 : 0} size={140} color={contextGlobalState ? '#10b981' : '#ef4444'} label={contextGlobalState ? 'Activo' : 'Inactivo'} />
              </motion.div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
                <div>
                  <p className="font-medium text-white">Estado Global</p>
                  <p className="text-sm text-gray-400">Activa o desactiva el bot en todos los grupos</p>
                </div>
                <button onClick={() => contextSetGlobalState(!contextGlobalState)}
                  className={`relative w-14 h-7 rounded-full transition-colors ${contextGlobalState ? 'bg-emerald-500' : 'bg-gray-600'}`}>
                  <motion.div animate={{ x: contextGlobalState ? 28 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
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
            <Button variant="primary" className="w-full" icon={<Save className="w-4 h-4" />} onClick={saveGlobalMessage} loading={isSaving}>
              Guardar Mensaje
            </Button>
          </Card>

          {/* Bot Configuration */}
          <Card animated delay={0.4} className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400"><Settings className="w-5 h-5" /></div>
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
              <Button variant="primary" className="w-full" icon={<Save className="w-4 h-4" />} onClick={saveBotConfig} loading={isSaving}>
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
                  {systemConfig.maintenanceMode && (
                    <div className="flex items-center mt-1 text-orange-400 text-xs">
                      <Wrench className="w-3 h-3 mr-1" />
                      <span>Activo - Solo administradores pueden acceder</span>
                    </div>
                  )}
                </div>
                <button onClick={toggleMaintenanceMode}
                  className={`relative w-14 h-7 rounded-full transition-colors ${systemConfig.maintenanceMode ? 'bg-orange-500' : 'bg-gray-600'}`}>
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
              <Button variant="primary" className="w-full" icon={<Save className="w-4 h-4" />} onClick={saveSystemConfig} loading={isSaving}>
                Guardar Configuración
              </Button>
            </div>
          </Card>

          {/* Admin IPs Management */}
          <Card animated delay={0.55} className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400"><Shield className="w-5 h-5" /></div>
              <h2 className="text-lg font-semibold text-white">IPs de Administradores</h2>
            </div>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white/5">
                <p className="text-sm text-gray-400 mb-2">Tu IP actual:</p>
                <p className="text-white font-mono text-lg">{systemConfig.currentIP || 'Cargando...'}</p>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="mt-2" 
                  onClick={addCurrentIP}
                  loading={isSaving}
                >
                  Agregar como IP de administrador
                </Button>
              </div>
              
              {systemConfig.adminIPs && systemConfig.adminIPs.length > 0 && (
                <div>
                  <p className="text-sm text-gray-400 mb-2">IPs permitidas durante mantenimiento:</p>
                  <div className="space-y-2">
                    {systemConfig.adminIPs.map((ip, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                        <span className="text-white font-mono">{ip}</span>
                        <span className="text-xs text-green-400">✓ Permitida</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-xs text-yellow-400">
                  💡 Las IPs agregadas aquí podrán acceder al panel incluso durante el modo mantenimiento.
                  Localhost (127.0.0.1) está permitido por defecto.
                </p>
              </div>
            </div>
          </Card>

          {/* System Info */}
          <Card animated delay={0.6} className="p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold text-white mb-6">Información del Sistema</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-white/5">
                <p className="text-xs text-gray-500 mb-1">CPU</p>
                <p className="text-white font-medium truncate">{systemStats?.cpu?.model || 'N/A'}</p>
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
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Settings className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Configuraciones</p>
                <p className="text-xl font-bold text-white">{stats.totalConfigurations}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <Database className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Ambiente</p>
                <p className="text-lg font-bold text-white capitalize">{stats.currentEnvironment}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <History className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Versiones</p>
                <p className="text-xl font-bold text-white">{stats.totalVersions}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/20">
                <FileText className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Backups</p>
                <p className="text-xl font-bold text-white">{stats.totalBackups}</p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar de configuraciones */}
        <div className="lg:col-span-1">
          <div className="glass-card p-4">
            <h2 className="text-lg font-semibold text-white mb-4">Secciones</h2>
            <div className="space-y-2">
              {configurations.map((config) => {
                const Icon = config.icon;
                return (
                  <button
                    key={config.key}
                    onClick={() => setSelectedConfig(config.key)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      selectedConfig === config.key
                        ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <div className="text-left">
                      <p className="font-medium">{config.name}</p>
                      <p className="text-xs opacity-70">{config.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Editor principal */}
        <div className="lg:col-span-3">
          <div className="glass-card">
            {/* Header del editor */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-white">
                    {configurations.find(c => c.key === selectedConfig)?.name || 'Configuración'}
                  </h2>
                  {hasChanges && (
                    <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                      Cambios sin guardar
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setShowJsonEditor(!showJsonEditor)}
                    variant="secondary"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    {showJsonEditor ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    JSON
                  </Button>
                  
                  {hasChanges && (
                    <Button
                      onClick={resetConfiguration}
                      variant="secondary"
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Descartar
                    </Button>
                  )}
                  
                  <Button
                    onClick={saveConfiguration}
                    loading={isSaving}
                    disabled={!hasChanges}
                    variant="primary"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <Save className="w-3 h-3" />
                    Guardar
                  </Button>
                </div>
              </div>
            </div>

            {/* Errores de validación */}
            {validationErrors.length > 0 && (
              <div className="p-4 bg-red-500/10 border-b border-red-500/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
                  <div>
                    <p className="text-red-400 font-medium">Errores de validación:</p>
                    <ul className="mt-1 text-sm text-red-300">
                      {validationErrors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Contenido del editor */}
            <div className="p-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
                </div>
              ) : (
                renderConfigEditor()
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Historial de versiones */}
      <AnimatePresence>
        {showVersions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card"
          >
            <div className="p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">
                Historial de Versiones - {selectedConfig}
              </h2>
            </div>
            
            <div className="divide-y divide-white/5">
              {versions.length === 0 ? (
                <div className="p-8 text-center">
                  <History className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No hay versiones registradas</p>
                </div>
              ) : (
                versions.map((version) => (
                  <div key={version.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          version.state === 'active' ? 'bg-green-400' :
                          version.state === 'rollback' ? 'bg-yellow-400' :
                          'bg-gray-400'
                        }`} />
                        <div>
                          <p className="font-medium text-white">
                            Versión {version.id.substring(0, 8)}
                          </p>
                          <p className="text-sm text-gray-400">
                            {new Date(version.timestamp).toLocaleString()} por {version.userId}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          version.state === 'active' ? 'bg-green-500/20 text-green-400' :
                          version.state === 'rollback' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {version.state}
                        </span>
                        
                        <Button
                          onClick={() => rollbackToVersion(version.id)}
                          variant="secondary"
                          size="sm"
                          className="flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Rollback
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
