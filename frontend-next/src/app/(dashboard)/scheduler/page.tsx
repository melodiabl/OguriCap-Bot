'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Calendar, Clock, Send, Pause, Play, Trash2, Edit,
  MessageSquare, Repeat, AlertCircle, CheckCircle
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AutoRefreshIndicator } from '@/components/ui/AutoRefreshIndicator';
import api from '@/services/api';
import { useGroups } from '@/contexts/GroupsContext';
import toast from 'react-hot-toast';

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
        console.error('Error loading groups:', error);
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
      toast.error('Error al cargar mensajes programados');
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateMessage = async () => {
    try {
      if (!formData.title || !formData.message || !formData.schedule_time) {
        toast.error('Completa todos los campos requeridos');
        return;
      }

      if (formData.schedule_type === 'once' && !formData.schedule_date) {
        toast.error('Selecciona una fecha para el mensaje único');
        return;
      }

      if (formData.schedule_type === 'weekly' && formData.repeat_days.length === 0) {
        toast.error('Selecciona al menos un día para el mensaje semanal');
        return;
      }

      await api.createScheduledMessage(formData);
      toast.success('Mensaje programado creado exitosamente');
      setShowCreateModal(false);
      resetForm();
      loadMessages();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Error al crear mensaje programado');
    }
  };

  const handleUpdateMessage = async () => {
    if (!editingMessage) return;
    
    try {
      await api.updateScheduledMessage(editingMessage.id, formData);
      toast.success('Mensaje programado actualizado');
      setEditingMessage(null);
      resetForm();
      loadMessages();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Error al actualizar mensaje');
    }
  };

  const handleDeleteMessage = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este mensaje programado?')) return;
    
    try {
      await api.deleteScheduledMessage(id);
      toast.success('Mensaje programado eliminado');
      loadMessages();
    } catch (error) {
      toast.error('Error al eliminar mensaje');
    }
  };

  const handleToggleMessage = async (id: number, enabled: boolean) => {
    try {
      await api.updateScheduledMessage(id, { enabled });
      toast.success(enabled ? 'Mensaje activado' : 'Mensaje pausado');
      loadMessages();
    } catch (error) {
      toast.error('Error al cambiar estado del mensaje');
    }
  };

  const handleSendNow = async (id: number) => {
    if (!confirm('¿Enviar este mensaje ahora?')) return;
    
    try {
      await api.sendScheduledMessageNow(id);
      toast.success('Mensaje enviado exitosamente');
      loadMessages();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Error al enviar mensaje');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-3xl font-bold text-white">Programador de Mensajes</h1>
          <p className="text-gray-400 mt-1">Programa mensajes automáticos para tu comunidad</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
          <AutoRefreshIndicator isActive={true} interval={60000} onRefresh={loadMessages} />
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
            Nuevo Mensaje
          </Button>
        </motion.div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-500/20">
              <Calendar className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{messages.length}</p>
              <p className="text-xs text-gray-400">Total Programados</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{messages.filter(m => m.enabled).length}</p>
              <p className="text-xs text-gray-400">Activos</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {messages.filter(m => m.enabled && new Date(m.next_send) > new Date()).length}
              </p>
              <p className="text-xs text-gray-400">Pendientes</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/20">
              <Send className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {messages.reduce((sum, m) => sum + m.sent_count, 0)}
              </p>
              <p className="text-xs text-gray-400">Enviados</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Messages List */}
      <div className="space-y-4">
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
              transition={{ delay: index * 0.1 }}
            >
              <Card className="p-6 hover:bg-white/5 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-white">{message.title}</h3>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        message.enabled 
                          ? 'bg-emerald-500/20 text-emerald-400' 
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
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-red-500/20 text-red-400'
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
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
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
                      <p className="text-xs text-red-400 mt-1">
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
                      <div className="text-xs text-amber-400 mt-1">
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
