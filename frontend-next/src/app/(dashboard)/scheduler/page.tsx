'use client';
import { notify } from '@/lib/notif';
import { getErrorMessage } from '@/lib/utils';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Plus, Calendar, Clock, Send, Pause, Play, Trash2, Edit,
  MessageSquare, Repeat, AlertCircle, CheckCircle, Radio
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AutoRefreshIndicator } from '@/components/ui/AutoRefreshIndicator';
import { PageHeader } from '@/components/ui/PageHeader';
import { Reveal } from '@/components/motion/Reveal';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import api from '@/services/api';
import { useGroups } from '@/contexts/GroupsContext';


interface ScheduledMessage {
  id: number;
  title: string;
  message: string;
  target_type: 'group' | 'broadcast';
  target_id?: string;
  target_name?: string;
  schedule_type: 'once' | 'daily' | 'weekly' | 'monthly';
  schedule_time: string;
  schedule_date?: string;
  repeat_days?: number[];
  enabled: boolean;
  last_sent?: string;
  next_send: string;
  sent_count: number;
  created_at: string;
}

const SCHEDULE_TYPES = [
  { value: 'once', label: 'Una vez', icon: Calendar },
  { value: 'daily', label: 'Diario', icon: Repeat },
  { value: 'weekly', label: 'Semanal', icon: Repeat },
  { value: 'monthly', label: 'Mensual', icon: Repeat },
];

const WEEKDAYS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
];

export default function SchedulerPage() {
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const { groups: contextGroups, isLoading: groupsLoading, error: groupsError, refreshGroups } = useGroups(); // Usar el context en lugar de cargar grupos localmente
  const [groups, setGroups] = useState<any[]>([]); // Estado local para grupos como fallback
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMessage, setEditingMessage] = useState<ScheduledMessage | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    target_type: 'broadcast' as 'group' | 'broadcast',
    target_id: '',
    schedule_type: 'once' as 'once' | 'daily' | 'weekly' | 'monthly',
    schedule_date: '',
    schedule_time: '',
    repeat_days: [] as number[],
    enabled: true
  });

  // Cargar grupos directamente como fallback (solo si es necesario)
  const loadGroupsDirectly = async () => {
    try {
      const response = await api.getGroups(1, 50); // Reducir límite para evitar rate limit
      const groupsData = response?.grupos || response?.data || [];
      setGroups(groupsData);
    } catch (error) {
      // Silenciar errores de rate limit
      if (error?.response?.status !== 429) {
        console.error('Error loading groups:', getErrorMessage(error));
      }
    }
  };

  // Usar grupos del contexto si están disponibles, sino usar los cargados directamente
  const availableGroups = contextGroups.length > 0 ? contextGroups : groups;

  useEffect(() => {
    loadMessages();
    // Solo cargar grupos directamente si no hay grupos del contexto
    if (contextGroups.length === 0) {
      loadGroupsDirectly();
    }
  }, [contextGroups.length]);

  const loadMessages = async () => {
    try {
      const response = await api.getScheduledMessages();
      setMessages(response.data || []);
    } catch (error) {
      notify.error('Error al cargar mensajes programados');
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateMessage = async () => {
    try {
      if (!formData.title || !formData.message || !formData.schedule_time) {
        notify.error('Completa todos los campos requeridos');
        return;
      }

      if (formData.schedule_type === 'once' && !formData.schedule_date) {
        notify.error('Selecciona una fecha para el mensaje único');
        return;
      }

      if (formData.schedule_type === 'weekly' && formData.repeat_days.length === 0) {
        notify.error('Selecciona al menos un día para el mensaje semanal');
        return;
      }

      await api.createScheduledMessage(formData);
      notify.success('Mensaje programado creado exitosamente');
      setShowCreateModal(false);
      resetForm();
      loadMessages();
    } catch (error: any) {
      notify.error(error?.response?.data?.error || 'Error al crear mensaje programado');
    }
  };

  const handleUpdateMessage = async () => {
    if (!editingMessage) return;
    
    try {
      await api.updateScheduledMessage(editingMessage.id, formData);
      notify.success('Mensaje programado actualizado');
      setEditingMessage(null);
      resetForm();
      loadMessages();
    } catch (error: any) {
      notify.error(error?.response?.data?.error || 'Error al actualizar mensaje');
    }
  };

  const handleDeleteMessage = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este mensaje programado?')) return;
    
    try {
      await api.deleteScheduledMessage(id);
      notify.success('Mensaje programado eliminado');
      loadMessages();
    } catch (error) {
      notify.error('Error al eliminar mensaje');
    }
  };

  const handleToggleMessage = async (id: number, enabled: boolean) => {
    try {
      await api.updateScheduledMessage(id, { enabled });
      notify.success(enabled ? 'Mensaje activado' : 'Mensaje pausado');
      loadMessages();
    } catch (error) {
      notify.error('Error al cambiar estado del mensaje');
    }
  };

  const handleSendNow = async (id: number) => {
    if (!confirm('¿Enviar este mensaje ahora?')) return;
    
    try {
      await api.sendScheduledMessageNow(id);
      notify.success('Mensaje enviado exitosamente');
      loadMessages();
    } catch (error: any) {
      notify.error(error?.response?.data?.error || 'Error al enviar mensaje');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      message: '',
      target_type: 'broadcast',
      target_id: '',
      schedule_type: 'once',
      schedule_date: '',
      schedule_time: '',
      repeat_days: [],
      enabled: true
    });
  };

  const openEditModal = (message: ScheduledMessage) => {
    setEditingMessage(message);
    setFormData({
      title: message.title,
      message: message.message,
      target_type: message.target_type,
      target_id: message.target_id || '',
      schedule_type: message.schedule_type,
      schedule_date: message.schedule_date || '',
      schedule_time: message.schedule_time,
      repeat_days: message.repeat_days || [],
      enabled: message.enabled
    });
    setShowCreateModal(true);
  };

  const toggleRepeatDay = (day: number) => {
    setFormData(prev => ({
      ...prev,
      repeat_days: prev.repeat_days.includes(day)
        ? prev.repeat_days.filter(d => d !== day)
        : [...prev.repeat_days, day].sort()
    }));
  };

  const formatNextSend = (nextSend: string) => {
    const date = new Date(nextSend);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffMs < 0) return 'Vencido';
    if (diffDays > 0) return `En ${diffDays} días`;
    if (diffHours > 0) return `En ${diffHours} horas`;
    return 'Próximamente';
  };

  const shouldReduceMotion = useReducedMotion();
  const activeCount = messages.filter(m => m.enabled).length;
  const pendingCount = messages.filter(m => m.enabled && new Date(m.next_send) > new Date()).length;
  const totalSent = messages.reduce((sum, m) => sum + m.sent_count, 0);

  const schedulerLanes = [
    {
      label: 'Programados',
      value: `${messages.length}`,
      description: messages.length > 0 ? 'Mensajes configurados en el sistema.' : 'Sin mensajes configurados aún.',
      icon: <Calendar className="w-4 h-4" />,
      badge: 'total',
      badgeClassName: 'border-white/10 bg-white/[0.05] text-white/70',
      glowClassName: 'from-[rgb(var(--page-a))]/18 via-oguri-cyan/10 to-transparent',
    },
    {
      label: 'Activos ahora',
      value: `${activeCount}`,
      description: activeCount > 0 ? 'Mensajes activos listos para enviarse.' : 'Ningún mensaje habilitado.',
      icon: <CheckCircle className="w-4 h-4" />,
      badge: activeCount > 0 ? 'live' : 'off',
      badgeClassName: activeCount > 0 ? 'border-[rgb(var(--success))]/20 bg-[rgb(var(--success))]/10 text-[#c7f9d8]' : 'border-white/10 bg-white/[0.05] text-white/70',
      glowClassName: 'from-[rgb(var(--success))]/18 via-oguri-cyan/10 to-transparent',
    },
    {
      label: 'En cola',
      value: `${pendingCount}`,
      description: pendingCount > 0 ? 'Esperando su ventana de envío.' : 'No hay cola pendiente.',
      icon: <Clock className="w-4 h-4" />,
      badge: pendingCount > 0 ? 'queue' : 'clear',
      badgeClassName: pendingCount > 0 ? 'border-warning/20 bg-warning/10 text-warning/80' : 'border-white/10 bg-white/[0.05] text-white/70',
      glowClassName: 'from-amber-400/18 via-oguri-gold/10 to-transparent',
    },
    {
      label: 'Enviados',
      value: `${totalSent}`,
      description: totalSent > 0 ? 'Total de mensajes entregados.' : 'Sin historial de envíos aún.',
      icon: <Send className="w-4 h-4" />,
      badge: totalSent > 0 ? 'ok' : 'new',
      badgeClassName: totalSent > 0 ? 'border-oguri-cyan/20 bg-oguri-cyan/10 text-oguri-cyan' : 'border-white/10 bg-white/[0.05] text-white/70',
      glowClassName: 'from-oguri-cyan/18 via-oguri-blue/10 to-transparent',
    },
  ];

  return (
    <div className="panel-page relative overflow-hidden">
      {/* Ambient atmosphere */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[-8%] top-[-4rem] -z-10 h-[420px] overflow-hidden">
        <div className="module-atmosphere" />
        {!shouldReduceMotion && (
          <>
            <motion.div
              className="absolute left-[8%] top-[12%] h-52 w-52 rounded-full bg-[rgb(var(--page-a))]/18 blur-3xl"
              animate={{ x: [0, 18, 0], y: [0, 14, 0], opacity: [0.18, 0.38, 0.18] }}
              transition={{ repeat: Infinity, duration: 11, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute right-[10%] top-[10%] h-56 w-56 rounded-full bg-oguri-cyan/16 blur-3xl"
              animate={{ x: [0, -18, 0], y: [0, 18, 0], opacity: [0.16, 0.36, 0.16] }}
              transition={{ repeat: Infinity, duration: 12, ease: 'easeInOut', delay: 0.6 }}
            />
          </>
        )}
      </div>

      {/* HUD hero banner */}
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
              <Calendar className="h-3.5 w-3.5 text-[rgb(var(--success))]/80" />
              Programador activo
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Mensajes programados</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-gray-300">
              Configura mensajes automáticos recurrentes para mantener activa tu comunidad en WhatsApp.
            </p>
          </div>
          <div className="panel-hero-meta-grid">
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Programados</p>
              <p className="mt-2 text-lg font-black text-white">{messages.length}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Activos</p>
              <p className="mt-2 text-lg font-black text-white">{activeCount}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Enviados</p>
              <p className="mt-2 text-lg font-black text-white">{totalSent}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Header */}
      <PageHeader
        title="Programador de Mensajes"
        description="Programa mensajes automáticos para tu comunidad"
        icon={<Calendar className="w-5 h-5 text-primary-400" />}
        actions={
          <>
            <AutoRefreshIndicator isActive={true} interval={60000} onRefresh={loadMessages} />
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
              Nuevo Mensaje
            </Button>
          </>
        }
      />

      {/* Lane cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {schedulerLanes.map((lane, index) => (
          <motion.div
            key={lane.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 + index * 0.05, duration: 0.3 }}
            className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-[#101512]/86 p-4 shadow-[0_22px_70px_-36px_rgba(0,0,0,0.4)]"
          >
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${lane.glowClassName}`} />
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <div className="relative z-10">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white">
                  {lane.icon}
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${lane.badgeClassName}`}>
                  {lane.badge}
                </span>
              </div>
              <div className="mt-4">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500">{lane.label}</p>
                <p className="mt-1 text-base font-black text-white">{lane.value}</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-400">{lane.description}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Stats Cards (compact, after lane cards) */}
      <Stagger className="grid grid-cols-1 md:grid-cols-4 gap-4" delay={0.02} stagger={0.07}>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <Card hover={false} className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary-500/20">
                <Calendar className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  <AnimatedNumber value={messages.length} />
                </p>
                <p className="text-xs text-gray-400">Total Programados</p>
              </div>
            </div>
          </Card>
        </StaggerItem>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <Card hover={false} className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/20">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  <AnimatedNumber value={messages.filter(m => m.enabled).length} />
                </p>
                <p className="text-xs text-gray-400">Activos</p>
              </div>
            </div>
          </Card>
        </StaggerItem>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <Card hover={false} className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/20">
                <Clock className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  <AnimatedNumber value={messages.filter(m => m.enabled && new Date(m.next_send) > new Date()).length} />
                </p>
                <p className="text-xs text-gray-400">Pendientes</p>
              </div>
            </div>
          </Card>
        </StaggerItem>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <Card hover={false} className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/20">
                <Send className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  <AnimatedNumber value={messages.reduce((sum, m) => sum + m.sent_count, 0)} />
                </p>
                <p className="text-xs text-gray-400">Enviados</p>
              </div>
            </div>
          </Card>
        </StaggerItem>
      </Stagger>

      {/* Messages List */}
      <Reveal className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="h-4 bg-white/10 rounded mb-2 w-1/3"></div>
                  <div className="h-3 bg-white/5 rounded mb-4 w-2/3"></div>
                  <div className="h-3 bg-white/5 rounded w-1/4"></div>
                </div>
                <div className="flex gap-2">
                  <div className="h-8 bg-white/10 rounded w-16"></div>
                  <div className="h-8 bg-white/10 rounded w-16"></div>
                </div>
              </div>
            </Card>
          ))
        ) : messages.length === 0 ? (
          <Card className="p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No hay mensajes programados</h3>
            <p className="text-gray-400 mb-6">
              Crea tu primer mensaje programado para mantener activa tu comunidad
            </p>
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
              Crear Primer Mensaje
            </Button>
          </Card>
        ) : (
          messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index < 8 ? index * 0.05 : 0 }}
            >
              <Card className="p-6 hover:bg-white/5 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-white">{message.title}</h3>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        message.enabled 
                          ? 'bg-success/20 text-success' 
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {message.enabled ? 'Activo' : 'Pausado'}
                      </div>
                      <div className="px-2 py-1 rounded-full text-xs font-medium bg-primary-500/20 text-primary-400">
                        {SCHEDULE_TYPES.find(t => t.value === message.schedule_type)?.label}
                      </div>
                    </div>
                    
                    <p className="text-gray-300 text-sm mb-3 line-clamp-2">{message.message}</p>
                    
                    <div className="flex items-center gap-6 text-xs text-gray-400">
                      <div className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        <span>{message.target_type === 'broadcast' ? 'Difusión' : message.target_name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{message.schedule_time}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Send className="w-3 h-3" />
                        <span>{message.sent_count} enviados</span>
                      </div>
                      {message.last_sent && (
                        <div>
                          <span>Último: {new Date(message.last_sent).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-3 flex items-center gap-2">
                      <div className={`px-2 py-1 rounded text-xs font-medium ${
                        new Date(message.next_send) > new Date()
                          ? 'bg-warning/20 text-warning'
                          : 'bg-danger/20 text-danger'
                      }`}>
                        Próximo: {formatNextSend(message.next_send)}
                      </div>
                      {message.repeat_days && message.repeat_days.length > 0 && (
                        <div className="text-xs text-gray-400">
                          Días: {message.repeat_days.map(d => WEEKDAYS[d].label).join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Send className="w-3 h-3" />}
                      onClick={() => handleSendNow(message.id)}
                    >
                      Enviar Ahora
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Edit className="w-3 h-3" />}
                      onClick={() => openEditModal(message)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant={message.enabled ? "secondary" : "success"}
                      size="sm"
                      icon={message.enabled ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      onClick={() => handleToggleMessage(message.id, !message.enabled)}
                    >
                      {message.enabled ? 'Pausar' : 'Activar'}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<Trash2 className="w-3 h-3" />}
                      onClick={() => handleDeleteMessage(message.id)}
                    >
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </Reveal>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 overlay-scrim flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 rounded-2xl border border-white/10 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">
                {editingMessage ? 'Editar Mensaje' : 'Programar Nuevo Mensaje'}
              </h2>
              <Button
                variant="secondary"
                size="sm"
                icon={<AlertCircle className="w-4 h-4" />}
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingMessage(null);
                  resetForm();
                }}
              />
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Título del Mensaje *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ej: Recordatorio Diario"
                  className="input-glass w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Mensaje *</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Escribe el mensaje que se enviará..."
                  rows={4}
                  className="input-glass w-full resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Destino</label>
                  <select
                    value={formData.target_type}
                    onChange={(e) => setFormData({ ...formData, target_type: e.target.value as 'group' | 'broadcast' })}
                    className="input-glass w-full"
                  >
                    <option value="broadcast">Difusión (Todos los grupos)</option>
                    <option value="group">Grupo específico</option>
                  </select>
                </div>
                {formData.target_type === 'group' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Grupo {groupsLoading && <span className="text-xs">(Cargando...)</span>}
                    </label>
                    <select
                      value={formData.target_id}
                      onChange={(e) => setFormData({ ...formData, target_id: e.target.value })}
                      className="input-glass w-full"
                      disabled={groupsLoading}
                    >
                      <option value="">
                        {groupsLoading 
                          ? 'Cargando grupos...' 
                          : availableGroups.length === 0 
                            ? 'No hay grupos disponibles' 
                            : 'Seleccionar grupo'
                        }
                      </option>
                      {availableGroups.map(group => (
                        <option key={group.wa_jid} value={group.wa_jid}>
                          {group.nombre} ({group.wa_jid})
                        </option>
                      ))}
                    </select>
                    {groupsError && (
                      <p className="text-xs text-danger mt-1">
                        Error: {groupsError}
                        <button 
                          onClick={refreshGroups}
                          className="ml-2 text-primary-400 hover:text-primary-300"
                        >
                          Reintentar
                        </button>
                      </p>
                    )}
                    {!groupsLoading && availableGroups.length === 0 && !groupsError && (
                      <div className="text-xs text-warning mt-1">
                        <p>No hay grupos disponibles. Asegúrate de que el bot esté conectado a grupos de WhatsApp.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Tipo de Programación</label>
                  <select
                    value={formData.schedule_type}
                    onChange={(e) => setFormData({ ...formData, schedule_type: e.target.value as any })}
                    className="input-glass w-full"
                  >
                    {SCHEDULE_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Hora *</label>
                  <input
                    type="time"
                    value={formData.schedule_time}
                    onChange={(e) => setFormData({ ...formData, schedule_time: e.target.value })}
                    className="input-glass w-full"
                  />
                </div>
              </div>

              {formData.schedule_type === 'once' && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Fecha *</label>
                  <input
                    type="date"
                    value={formData.schedule_date}
                    onChange={(e) => setFormData({ ...formData, schedule_date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="input-glass w-full"
                  />
                </div>
              )}

              {formData.schedule_type === 'weekly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Días de la Semana *</label>
                  <div className="flex gap-2 flex-wrap">
                    {WEEKDAYS.map(day => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleRepeatDay(day.value)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          formData.repeat_days.includes(day.value)
                            ? 'bg-primary-500 text-white'
                            : 'bg-white/10 text-gray-400 hover:bg-white/20'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="w-4 h-4 text-primary-500 bg-gray-700 border-gray-600 rounded focus:ring-primary-500"
                />
                <label htmlFor="enabled" className="text-sm text-gray-300">
                  Activar mensaje inmediatamente
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-6 border-t border-white/10">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingMessage(null);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                icon={<Calendar className="w-4 h-4" />}
                className="flex-1"
                onClick={editingMessage ? handleUpdateMessage : handleCreateMessage}
              >
                {editingMessage ? 'Actualizar' : 'Programar'} Mensaje
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
