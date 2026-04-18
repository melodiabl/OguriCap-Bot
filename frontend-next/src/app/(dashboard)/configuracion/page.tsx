'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Wrench,
  Mail,
  Server,
  Lock,
  AtSign
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Card, StatCard } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { SimpleSelect as Select } from '@/components/ui/Select';
import { ProgressRing } from '@/components/ui/Charts';
import { useSocketConnection } from '@/contexts/SocketContext';
import { useSystemStats, useBotStatus } from '@/hooks/useRealTime';
import { useBotGlobalState as useBotGlobalStateContext } from '@/contexts/BotGlobalStateContext';
import { useGlobalUpdate } from '@/contexts/GlobalUpdateContext';
import { useNotifications } from '@/contexts/NotificationContext';
import api from '@/services/api';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

interface ConfigSection {
  key: string;
  name: string;
  description: string;
  icon: any;
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

const EMAIL_PREVIEW_TEMPLATES = [
  { id: 'test', label: 'Prueba' },
  { id: 'registration', label: 'Registro' },
  { id: 'welcome', label: 'Bienvenida' },
  { id: 'password-reset', label: 'Reset' },
  { id: 'security-alert', label: 'Seguridad' },
  { id: 'notification', label: 'Notificación' },
  { id: 'role_updated', label: 'Promoción' },
  { id: 'subbot_disconnected', label: 'Subbot Offline' },
  { id: 'broadcast_announcement', label: 'Anuncio' },
  { id: 'broadcast_update', label: 'Novedades' },
  { id: 'broadcast_alert', label: 'Alerta' },
] as const;

const EMAIL_PROVIDER_PRESETS = [
  { id: 'gmail-starttls', label: 'Gmail 587', host: 'smtp.gmail.com', port: 587, secure: true, hint: 'App Password + STARTTLS' },
  { id: 'gmail-ssl', label: 'Gmail 465', host: 'smtp.gmail.com', port: 465, secure: true, hint: 'TLS implícito' },
  { id: 'outlook', label: 'Outlook', host: 'smtp.office365.com', port: 587, secure: true, hint: 'STARTTLS' },
  { id: 'zoho', label: 'Zoho', host: 'smtp.zoho.com', port: 587, secure: true, hint: 'STARTTLS' },
  { id: 'brevo', label: 'Brevo', host: 'smtp-relay.brevo.com', port: 587, secure: true, hint: 'SMTP relay' },
] as const;

export default function ConfiguracionPage() {
  const searchParams = useSearchParams();
  // System stats removed as they are not currently used in the summary lanes
  // const { memoryUsage, uptime } = useSystemStats();
  const { isConnected } = useBotStatus();
  const { isConnected: isSocketConnected } = useSocketConnection();
  
  const { isGloballyOn: contextGlobalState, setGlobalState: contextSetGlobalState } = useBotGlobalStateContext();
  const { refreshAll } = useGlobalUpdate();
  const { settings: notificationSettings, updateSettings: updateNotificationSettings } = useNotifications();

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
  
  const [emailStatus, setEmailStatus] = useState<any>(null);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [isEmailPreviewOpen, setIsEmailPreviewOpen] = useState(false);
  const [isLoadingEmailPreview, setIsLoadingEmailPreview] = useState(false);
  const [emailPreviewType, setEmailPreviewType] = useState<string>('test');
  const [emailPreviewMode, setEmailPreviewMode] = useState<'html' | 'text'>('html');
  const [emailPreviewData, setEmailPreviewData] = useState<any>(null);

  const [globalOffMessage, setGlobalOffMessage] = useState('');
  const [botConfig, setBotConfig] = useState<any>({});
  const [systemConfig, setSystemConfig] = useState<any>({});

  const hasChanges = useMemo(() => {
    return JSON.stringify(configData) !== JSON.stringify(originalData);
  }, [configData, originalData]);

  // Data Fetching
  const fetchConfigurations = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/config');
      const data = response.data;
      
      const sections = [
        { key: 'main', name: 'General', description: 'Ajustes globales', icon: Settings, color: 'blue' },
        { key: 'system', name: 'Sistema', description: 'Núcleo y recursos', icon: Cpu, color: 'purple' },
        { key: 'bot', name: 'Bot', description: 'Comportamiento WhatsApp', icon: Bot, color: 'cyan' },
        { key: 'security', name: 'Seguridad', description: 'Protección y acceso', icon: Shield, color: 'red' },
        { key: 'notifications', name: 'Notificaciones', description: 'Alertas y avisos', icon: Bell, color: 'yellow' },
      ];
      
      setConfigurations(sections as any);
      
      const fullData: any = {};
      sections.forEach(s => {
        fullData[s.key] = data.config?.[s.key] || {};
      });
      
      setConfigData(fullData);
      setOriginalData(JSON.parse(JSON.stringify(fullData)));
      
      if (data.stats) setStats(data.stats);
      if (data.versions) setVersions(data.versions);
      
      // Initialize specific states
      setGlobalOffMessage(data.config?.main?.globalOffMessage || '');
      setBotConfig(data.config?.bot || {});
      setSystemConfig(data.config?.system || {});
      
    } catch (error) {
      console.error(error);
      notify.error('No se pudieron cargar las configuraciones');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigurations();
  }, [fetchConfigurations]);

  // Actions
  const saveConfiguration = async () => {
    setSaving(true);
    try {
      await api.put(`/config/${selectedConfig}`, configData[selectedConfig]);
      setOriginalData(JSON.parse(JSON.stringify(configData)));
      notify.success('Configuración guardada correctamente');
      refreshAll();
      fetchConfigurations();
    } catch (error: any) {
      notify.error(error.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const resetConfiguration = () => {
    setConfigData(JSON.parse(JSON.stringify(originalData)));
    notify.info('Cambios descartados');
  };

  const getConfigValue = (path: string) => {
    const parts = path.split('.');
    let current = configData[selectedConfig];
    if (!current) return undefined;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    return current;
  };

  const updateConfigValue = (path: string, value: any) => {
    setConfigData((prev: any) => {
      const newData = JSON.parse(JSON.stringify(prev));
      const parts = path.split('.');
      let current = newData[selectedConfig];
      if (!current) newData[selectedConfig] = {};
      current = newData[selectedConfig];
      
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
      return newData;
    });
  };

  const exportConfiguration = async () => {
    try {
      const res = await api.get('/config/export');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `oguricap-config-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
    } catch (error) {
      notify.error('Error al exportar configuración');
    }
  };

  const importConfiguration = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        await api.post('/config/import', json);
        notify.success('Configuración importada. Reiniciando vista...');
        fetchConfigurations();
      } catch (error) {
        notify.error('Archivo de configuración inválido');
      }
    };
    reader.readAsText(file);
  };

  const rollbackToVersion = async (versionId: string) => {
    if (!confirm('¿Estás seguro de revertir a esta versión?')) return;
    try {
      await api.post(`/config/rollback/${versionId}`);
      notify.success('Sistema revertido correctamente');
      fetchConfigurations();
    } catch (error) {
      notify.error('Error al realizar rollback');
    }
  };

  // Email specific actions
  const refreshEmailStatus = async () => {
    setIsCheckingEmail(true);
    try {
      const res = await api.get('/config/email/status');
      setEmailStatus(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const openEmailPreview = async (type: string) => {
    setEmailPreviewType(type);
    setIsEmailPreviewOpen(true);
    setIsLoadingEmailPreview(true);
    try {
      const res = await api.get(`/config/email/preview/${type}`);
      setEmailPreviewData(res.data);
    } catch (error) {
      notify.error('Error al cargar preview');
    } finally {
      setIsLoadingEmailPreview(false);
    }
  };

  const verifyEmailSmtp = async () => {
    setIsVerifyingEmail(true);
    try {
      await api.post('/config/email/verify', configData.notifications?.email?.smtp);
      notify.success('Configuración SMTP válida');
    } catch (error) {
      notify.error('Fallo en la verificación SMTP');
    } finally {
      setIsVerifyingEmail(false);
    }
  };

  const sendTestEmail = async () => {
    if (!testEmailTo) return notify.warning('Ingresa un correo de destino');
    setIsTestingEmail(true);
    try {
      await api.post('/config/email/test', { to: testEmailTo });
      notify.success('Email de prueba enviado');
    } catch (error) {
      notify.error('Error al enviar email de prueba');
    } finally {
      setIsTestingEmail(false);
    }
  };

  const applyEmailProviderPreset = (presetId: string) => {
    const preset = EMAIL_PROVIDER_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    
    updateConfigValue('email.smtp.host', preset.host);
    updateConfigValue('email.smtp.port', preset.port);
    updateConfigValue('email.smtp.secure', preset.secure);
    notify.info(`Preset ${preset.label} aplicado`);
  };

  const copyEmailPreview = (mode: 'html' | 'text') => {
    const content = mode === 'html' ? emailPreviewData?.html : extractPlainTextFromHtml(emailPreviewData?.html || '');
    if (!content) return;
    navigator.clipboard.writeText(content);
    notify.success('Copiado al portapapeles');
  };

  const extractPlainTextFromHtml = (html: string) => {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  // Support / System actions
  const toggleMaintenanceMode = async () => {
    try {
      const newState = !systemConfig.maintenanceMode;
      await api.post('/config/system/maintenance', { enabled: newState });
      setSystemConfig({ ...systemConfig, maintenanceMode: newState });
      notify.success(`Mantenimiento ${newState ? 'activado' : 'desactivado'}`);
    } catch (error) {
      notify.error('Error al cambiar modo mantenimiento');
    }
  };

  const saveGlobalMessage = async () => {
    setSaving(true);
    try {
      await api.put('/config/main', { ...configData.main, globalOffMessage });
      notify.success('Mensaje guardado');
    } catch (error) {
      notify.error('Error al guardar mensaje');
    } finally {
      setSaving(false);
    }
  };

  const saveBotConfig = async () => {
    setSaving(true);
    try {
      await api.put('/config/bot', botConfig);
      notify.success('Configuración del bot guardada');
    } catch (error) {
      notify.error('Error al guardar configuración del bot');
    } finally {
      setSaving(false);
    }
  };

  const saveSystemConfig = async () => {
    setSaving(true);
    try {
      await api.put('/config/system', systemConfig);
      notify.success('Configuración del sistema guardada');
    } catch (error) {
      notify.error('Error al guardar configuración del sistema');
    } finally {
      setSaving(false);
    }
  };

  const addCurrentIP = async () => {
    try {
      await api.post('/config/system/admin-ip', { ip: systemConfig.currentIP });
      notify.success('IP agregada correctamente');
      fetchConfigurations();
    } catch (error) {
      notify.error('Error al agregar IP');
    }
  };

  const toggleAutoAddAdminIPOnLogin = async () => {
    try {
      const newState = !systemConfig.autoAddAdminIPOnLogin;
      await api.put('/config/system', { ...systemConfig, autoAddAdminIPOnLogin: newState });
      setSystemConfig({ ...systemConfig, autoAddAdminIPOnLogin: newState });
      notify.success(`Auto-guardado de IP ${newState ? 'activado' : 'desactivado'}`);
    } catch (error) {
      notify.error('Error al cambiar configuración de IP');
    }
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper render functions
  const renderMainConfigEditor = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Información General</h3>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Versión</label>
          <input type="text" value={getConfigValue('version') || ''} onChange={(e) => updateConfigValue('version', e.target.value)} className="input-glass" placeholder="1.0.0" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Ambiente</label>
          <select value={getConfigValue('environment') || ''} onChange={(e) => updateConfigValue('environment', e.target.value)} className="input-glass">
            <option value="development">Desarrollo</option>
            <option value="staging">Staging</option>
            <option value="production">Producción</option>
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
          <label className="block text-sm font-medium text-gray-300 mb-2">Nombre del Sistema</label>
          <input type="text" value={getConfigValue('name') || ''} onChange={(e) => updateConfigValue('name', e.target.value)} className="input-glass" placeholder="WhatsApp Bot Panel" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Memoria Máxima</label>
          <input type="text" value={getConfigValue('maxMemory') || ''} onChange={(e) => updateConfigValue('maxMemory', e.target.value)} className="input-glass" placeholder="512MB" />
        </div>
      </div>
    </div>
  );

  const renderBotConfigEditor = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Configuración del Bot</h3>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Nombre del Bot</label>
          <input type="text" value={getConfigValue('name') || ''} onChange={(e) => updateConfigValue('name', e.target.value)} className="input-glass" placeholder="Oguri Bot" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Prefijo</label>
          <input type="text" value={getConfigValue('prefix') || ''} onChange={(e) => updateConfigValue('prefix', e.target.value)} className="input-glass" placeholder="#" />
        </div>
      </div>
    </div>
  );

  const renderSecurityConfigEditor = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Configuración de Seguridad</h3>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Requests por Minuto</label>
          <input type="number" value={getConfigValue('maxRequestsPerMinute') || ''} onChange={(e) => updateConfigValue('maxRequestsPerMinute', parseInt(e.target.value))} className="input-glass" />
        </div>
      </div>
    </div>
  );

  const renderNotificationsConfigEditor = () => {
    const emailEnabled = Boolean(getConfigValue('email.enabled'));
    const smtpHost = String(getConfigValue('email.smtp.host') || '').trim();
    const smtpPort = String(getConfigValue('email.smtp.port') || '');
    const smtpSecure = Boolean(getConfigValue('email.smtp.secure'));
    const smtpUser = String(getConfigValue('email.smtp.user') || '').trim();
    const smtpPass = String(getConfigValue('email.smtp.pass') || '').trim();
    const smtpFrom = String(getConfigValue('email.smtp.from') || '').trim();
    const smtpReplyTo = String(getConfigValue('email.smtp.replyTo') || '').trim();
    const whatsappEnabled = Boolean(getConfigValue('whatsapp.enabled'));
    const adminNumbers = (getConfigValue('whatsapp.adminNumbers') || []) as string[];

    const emailBadge = !emailEnabled ? 'badge bg-white/5 text-gray-200 border-white/10' : smtpHost ? 'badge-success' : 'badge-warning';
    const emailBadgeText = !emailEnabled ? 'Desactivado' : smtpHost ? 'SMTP listo' : 'Falta host';

    const browserPushPermission = typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Email Card */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-200"><Mail className="w-5 h-5" /></div>
                <div>
                  <h4 className="font-bold text-white">Email Service</h4>
                  <p className="text-xs text-gray-400">SMTP para alertas críticas</p>
                </div>
              </div>
              <span className={emailBadge}>{emailBadgeText}</span>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <p className="text-sm font-medium text-white">Activar Servicio</p>
                <Switch checked={emailEnabled} onCheckedChange={(val) => updateConfigValue('email.enabled', val)} />
              </div>

              <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-4", !emailEnabled && "opacity-50 pointer-events-none")}>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Host SMTP</label>
                  <input type="text" value={smtpHost} onChange={(e) => updateConfigValue('email.smtp.host', e.target.value)} className="input-glass" placeholder="smtp.gmail.com" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Puerto</label>
                  <input type="number" value={smtpPort} onChange={(e) => updateConfigValue('email.smtp.port', parseInt(e.target.value))} className="input-glass" placeholder="587" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Usuario</label>
                  <input type="text" value={smtpUser} onChange={(e) => updateConfigValue('email.smtp.user', e.target.value)} className="input-glass" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Contraseña</label>
                  <input type="password" value={smtpPass} onChange={(e) => updateConfigValue('email.smtp.pass', e.target.value)} className="input-glass" />
                </div>
              </div>

              <div className={cn("space-y-4 pt-2", !emailEnabled && "opacity-50 pointer-events-none")}>
                 <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-300">Conexión Segura (TLS)</p>
                    <Switch checked={smtpSecure} onCheckedChange={(val) => updateConfigValue('email.smtp.secure', val)} />
                 </div>
                 
                 <div className="flex flex-wrap gap-2">
                    {EMAIL_PROVIDER_PRESETS.map(preset => (
                      <Button key={preset.id} variant="secondary" size="sm" onClick={() => applyEmailProviderPreset(preset.id)} className="text-[10px]">
                        {preset.label}
                      </Button>
                    ))}
                 </div>

                 <div className="pt-4 border-t border-white/10 flex gap-2">
                    <Button variant="secondary" size="sm" onClick={refreshEmailStatus} loading={isCheckingEmail} icon={<RefreshCw className="h-3 w-3" />}>Estado</Button>
                    <Button variant="secondary" size="sm" onClick={verifyEmailSmtp} loading={isVerifyingEmail} icon={<Shield className="h-3 w-3" />}>Verificar</Button>
                    <Button variant="primary" size="sm" onClick={sendTestEmail} loading={isTestingEmail} icon={<Mail className="h-3 w-3" />}>Test</Button>
                 </div>
              </div>
            </div>
          </Card>

          {/* WhatsApp Card */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-200"><Bell className="w-5 h-5" /></div>
                <div>
                  <h4 className="font-bold text-white">WhatsApp Alertas</h4>
                  <p className="text-xs text-gray-400">Notificaciones directas</p>
                </div>
              </div>
              <span className={cn("badge", whatsappEnabled ? "badge-success" : "bg-white/5 text-gray-400")}>
                {whatsappEnabled ? "Activo" : "Off"}
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <p className="text-sm font-medium text-white">Activar WhatsApp</p>
                <Switch checked={whatsappEnabled} onCheckedChange={(val) => updateConfigValue('whatsapp.enabled', val)} />
              </div>

              <div className={cn("space-y-2", !whatsappEnabled && "opacity-50 pointer-events-none")}>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Números Administradores</label>
                <textarea 
                  value={adminNumbers.join(', ')} 
                  onChange={(e) => updateConfigValue('whatsapp.adminNumbers', e.target.value.split(',').map(n => n.trim()).filter(Boolean))} 
                  className="input-glass min-h-[100px] resize-none" 
                  placeholder="Ej: 1234567890, 0987654321" 
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Panel Notifications */}
        <Card className="p-6">
           <div className="flex items-center gap-4 mb-8">
              <div className="p-2 rounded-xl bg-primary/20 text-primary"><Bell className="h-5 w-5" /></div>
              <div>
                <h4 className="font-bold text-white">Preferencias del Panel</h4>
                <p className="text-xs text-gray-400">Configuración de notificaciones en tiempo real</p>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
              <div className="flex items-center justify-between">
                 <div>
                   <p className="text-sm font-medium text-white">Notificaciones de Escritorio</p>
                   <p className="text-[10px] text-gray-500 uppercase tracking-tighter">Status: {browserPushPermission}</p>
                 </div>
                 <Switch checked={notificationSettings.push} onCheckedChange={(val) => updateNotificationSettings({ push: val })} />
              </div>
              <div className="flex items-center justify-between">
                 <p className="text-sm font-medium text-white">Alertas de Bot</p>
                 <Switch checked={notificationSettings.botEvents} onCheckedChange={(val) => updateNotificationSettings({ botEvents: val })} />
              </div>
              <div className="flex items-center justify-between">
                 <p className="text-sm font-medium text-white">Eventos de Usuarios</p>
                 <Switch checked={notificationSettings.users} onCheckedChange={(val) => updateNotificationSettings({ users: val })} />
              </div>
              <div className="flex items-center justify-between">
                 <p className="text-sm font-medium text-white">Errores Críticos</p>
                 <Switch checked={notificationSettings.critical} onCheckedChange={(val) => updateNotificationSettings({ critical: val })} />
              </div>
           </div>
        </Card>
      </div>
    );
  };

  const renderConfigEditor = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <RefreshCw className="h-10 w-10 text-primary animate-spin" />
          <p className="text-sm font-medium text-muted-foreground">Cargando datos del sistema...</p>
        </div>
      );
    }

    if (showJsonEditor) {
      return (
        <div className="space-y-4">
          <textarea
            value={JSON.stringify(configData[selectedConfig], null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                setConfigData((prev: any) => ({ ...prev, [selectedConfig]: parsed }));
              } catch (err) {}
            }}
            className="input-glass w-full h-[500px] font-mono text-sm resize-none p-6"
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-white/5 p-3 rounded-lg">
             <AlertTriangle className="h-3 w-3 text-amber-500" />
             Asegúrate de mantener el esquema JSON válido para evitar errores.
          </div>
        </div>
      );
    }

    switch (selectedConfig) {
      case 'main': return renderMainConfigEditor();
      case 'system': return renderSystemConfigEditor();
      case 'bot': return renderBotConfigEditor();
      case 'security': return renderSecurityConfigEditor();
      case 'notifications': return renderNotificationsConfigEditor();
      default: return null;
    }
  };

  const selectedConfigMeta = configurations.find((section) => section.key === selectedConfig);

  const configLanes = [
    {
      label: 'Seccion activa',
      value: selectedConfigMeta?.name || 'Cargando...',
      description: selectedConfigMeta?.description || 'Gestionando el núcleo del bot.',
      icon: <Settings className="w-4 h-4" />,
      badge: selectedConfig.toUpperCase(),
      badgeClassName: 'border-primary/20 bg-primary/10 text-primary',
      glowClassName: 'from-primary/10 via-transparent to-transparent',
    },
    {
      label: 'Cambios locales',
      value: hasChanges ? 'Pendientes' : 'Al día',
      description: hasChanges ? 'Hay ediciones sin persistir.' : 'Sincronizado con el servidor.',
      icon: <Save className="w-4 h-4" />,
      badge: hasChanges ? 'DIRTY' : 'OK',
      badgeClassName: hasChanges ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
      glowClassName: hasChanges ? 'from-amber-500/10 via-transparent to-transparent' : 'from-emerald-500/10 via-transparent to-transparent',
    },
    {
      label: 'Versiones',
      value: stats?.totalVersions || versions.length,
      description: 'Copias de seguridad activas.',
      icon: <History className="w-4 h-4" />,
      badge: 'BACKUP',
      badgeClassName: 'border-purple-500/20 bg-purple-500/10 text-purple-300',
      glowClassName: 'from-purple-500/10 via-transparent to-transparent',
    },
    {
      label: 'Modo Bot',
      value: contextGlobalState ? 'Encendido' : 'Apagado',
      description: 'Estado operativo global.',
      icon: <Zap className="w-4 h-4" />,
      badge: contextGlobalState ? 'LIVE' : 'OFF',
      badgeClassName: contextGlobalState ? 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300' : 'border-red-500/20 bg-red-500/10 text-red-300',
      glowClassName: contextGlobalState ? 'from-cyan-500/10 via-transparent to-transparent' : 'from-red-500/10 via-transparent to-transparent',
    },
  ];

  return (
    <div className="relative min-h-screen p-4 sm:p-8 lg:p-10 overflow-hidden">
      {/* Premium Ambient Background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(var(--page-a),0.05),transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(var(--page-b),0.05),transparent_40%)]" />
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <div className="relative z-10 space-y-10">
        <PageHeader 
          title="Configuración"
          description="Ajusta el núcleo del bot y gestiona servicios externos."
          icon={<Settings className="h-6 w-6 text-primary" />}
          actions={
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={resetConfiguration} disabled={!hasChanges || isSaving} icon={<RotateCcw className="h-4 w-4" />}>
                Descartar
              </Button>
              <Button variant="glow" onClick={saveConfiguration} loading={isSaving} disabled={!hasChanges} icon={<Save className="h-4 w-4" />}>
                Guardar Cambios
              </Button>
            </div>
          }
        />

        {/* Dynamic Meta Lanes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {configLanes.map((lane, i) => (
            <Card key={lane.label} delay={i * 0.05} animated className="p-4 bg-white/[0.02]">
              <div className={cn("absolute inset-0 opacity-10 bg-gradient-to-br", lane.glowClassName)} />
              <div className="relative z-10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-white/5 text-primary">{lane.icon}</div>
                  <Badge variant="outline" className={cn("text-[9px] font-black tracking-widest", lane.badgeClassName)}>{lane.badge}</Badge>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{lane.label}</p>
                  <p className="text-lg font-black text-white leading-none mt-1">{lane.value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-3 space-y-6">
            <Card className="p-2 bg-white/5 backdrop-blur-xl border-white/10">
              <div className="space-y-1">
                {configurations.map((section) => {
                  const Icon = section.icon;
                  const isActive = selectedConfig === section.key;
                  return (
                    <button
                      key={section.key}
                      onClick={() => setSelectedConfig(section.key)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300",
                        isActive ? "bg-primary text-primary-foreground shadow-glow-primary" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                      )}
                    >
                      <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center", isActive ? "bg-white/20" : "bg-white/5")}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black tracking-tight">{section.name}</p>
                        <p className={cn("text-[9px] opacity-70", isActive ? "text-white" : "text-muted-foreground")}>{section.key.toUpperCase()}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card className="p-6 bg-primary/5 border-primary/20">
               <div className="flex items-center gap-3 mb-6">
                 <History className="h-4 w-4 text-primary" />
                 <span className="text-xs font-black uppercase tracking-widest text-primary">Historial</span>
               </div>
               <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Entorno</span>
                    <Badge variant="outline" className="text-[9px] tracking-tight">{stats?.currentEnvironment || 'PROD'}</Badge>
                  </div>
                  <Button variant="secondary" size="sm" className="w-full" onClick={() => setShowVersions(!showVersions)}>
                    {showVersions ? 'Cerrar Registro' : 'Ver Registro'}
                  </Button>
               </div>
            </Card>
            
            <Card className="p-6">
               <div className="flex items-center gap-3 mb-4">
                 <Download className="h-4 w-4 text-muted-foreground" />
                 <span className="text-xs font-black uppercase tracking-widest">Utilidades</span>
               </div>
               <div className="grid grid-cols-1 gap-2">
                  <Button variant="secondary" size="sm" className="justify-start" onClick={exportConfiguration} icon={<Download className="h-3 w-3" />}>Exportar</Button>
                  <label className="w-full">
                    <input type="file" accept=".json" onChange={(e) => e.target.files?.[0] && importConfiguration(e.target.files[0])} className="hidden" />
                    <Button variant="secondary" size="sm" className="w-full justify-start" icon={<Upload className="h-3 w-3" />}>Importar</Button>
                  </label>
               </div>
            </Card>
          </div>

          {/* Main Area */}
          <div className="lg:col-span-9 space-y-8">
            <AnimatePresence mode="wait">
              {showVersions ? (
                <motion.div key="versions" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                   <Card className="p-8">
                      <div className="flex items-center justify-between mb-8">
                         <h3 className="text-xl font-black text-white tracking-tight">Registro de Versiones</h3>
                         <Button variant="ghost" size="sm" onClick={() => setShowVersions(false)} icon={<XCircle className="h-4 w-4" />}>Cerrar</Button>
                      </div>
                      <div className="divide-y divide-white/5">
                        {versions.length > 0 ? versions.map((v) => (
                          <div key={v.id} className="py-4 flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center font-mono text-[10px] text-primary">{v.id.substring(0, 8)}</div>
                              <div>
                                <p className="text-sm font-bold text-white">{new Date(v.timestamp).toLocaleString()}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">{v.userId} • {v.state}</p>
                              </div>
                            </div>
                            <Button variant="secondary" size="sm" onClick={() => rollbackToVersion(v.id)} icon={<RotateCcw className="h-3 w-3" />}>Rollback</Button>
                          </div>
                        )) : (
                          <div className="py-20 text-center text-muted-foreground">No hay versiones registradas</div>
                        )}
                      </div>
                   </Card>
                </motion.div>
              ) : (
                <motion.div key="editor" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                  <Card glow className="p-0 overflow-hidden min-h-[600px] flex flex-col">
                    <div className="p-6 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
                       <div className="flex items-center gap-4">
                          <div className="p-2 rounded-xl bg-primary/10 text-primary">
                             {selectedConfigMeta && React.createElement(selectedConfigMeta.icon, { className: "h-5 w-5" })}
                          </div>
                          <div>
                            <h3 className="text-lg font-black text-white tracking-tight">{selectedConfigMeta?.name}</h3>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{selectedConfigMeta?.description}</p>
                          </div>
                       </div>
                       <Button variant="ghost" size="sm" onClick={() => setShowJsonEditor(!showJsonEditor)} icon={showJsonEditor ? <Eye className="h-4 w-4" /> : <FileText className="h-4 w-4" />}>
                         {showJsonEditor ? 'Vista Visual' : 'Editor JSON'}
                       </Button>
                    </div>
                    <div className="flex-1 p-8">
                       {renderConfigEditor()}
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Modals */}
      <Modal
        isOpen={isEmailPreviewOpen}
        onClose={() => setIsEmailPreviewOpen(false)}
        title={`Preview Email: ${EMAIL_PREVIEW_TEMPLATES.find(t => t.id === emailPreviewType)?.label}`}
        className="max-w-5xl"
      >
        <div className="space-y-6">
           <div className="flex items-center justify-between">
              <div className="flex gap-2">
                 <Button variant={emailPreviewMode === 'html' ? 'primary' : 'secondary'} size="sm" onClick={() => setEmailPreviewMode('html')}>HTML</Button>
                 <Button variant={emailPreviewMode === 'text' ? 'primary' : 'secondary'} size="sm" onClick={() => setEmailPreviewMode('text')}>TEXTO</Button>
              </div>
              <Button variant="secondary" size="sm" onClick={() => copyEmailPreview(emailPreviewMode)} icon={<Copy className="h-3.5 w-3.5" />}>Copiar</Button>
           </div>

           <div className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden min-h-[500px]">
              {isLoadingEmailPreview ? (
                <div className="flex items-center justify-center h-[500px] text-muted-foreground animate-pulse">Generando vista previa...</div>
              ) : emailPreviewMode === 'html' ? (
                <iframe srcDoc={emailPreviewData?.html} className="w-full h-[500px] bg-white" title="Email Preview" />
              ) : (
                <pre className="p-6 text-sm text-gray-300 whitespace-pre-wrap">{extractPlainTextFromHtml(emailPreviewData?.html || '')}</pre>
              )}
           </div>
        </div>
      </Modal>
    </div>
  );
}
