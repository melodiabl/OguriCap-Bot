'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Edit, Trash2, Save, X, Code, MessageSquare, Users, 
  Zap, RefreshCw, Search, Filter, Copy, Play
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AutoRefreshIndicator } from '@/components/ui/AutoRefreshIndicator';
import api from '@/services/api';
import toast from 'react-hot-toast';

interface CustomCommand {
  id: number;
  name: string;
  trigger: string;
  response: string;
  description: string;
  category: string;
  enabled: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

const COMMAND_CATEGORIES = [
  { value: 'general', label: 'General', icon: MessageSquare },
  { value: 'moderation', label: 'Moderación', icon: Users },
  { value: 'fun', label: 'Diversión', icon: Zap },
  { value: 'info', label: 'Información', icon: Code },
];

export default function CustomCommandsPage() {
  const [commands, setCommands] = useState<CustomCommand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCommand, setEditingCommand] = useState<CustomCommand | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    trigger: '',
    response: '',
    description: '',
    category: 'general',
    enabled: true
  });

  useEffect(() => {
    loadCommands();
    const interval = setInterval(loadCommands, 120000); // Reducir a 2 minutos
    return () => clearInterval(interval);
  }, []);

  const loadCommands = async () => {
    try {
      const response = await api.getCustomCommands();
      setCommands(response.data || []);
    } catch (error) {
      toast.error('Error al cargar comandos');
      setCommands([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCommand = async () => {
    try {
      if (!formData.name || !formData.trigger || !formData.response) {
        toast.error('Completa todos los campos requeridos');
        return;
      }

      await api.createCustomCommand(formData);
      toast.success('Comando creado exitosamente');
      setShowCreateModal(false);
      resetForm();
      loadCommands();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Error al crear comando');
    }
  };

  const handleUpdateCommand = async () => {
    if (!editingCommand) return;
    
    try {
      await api.updateCustomCommand(editingCommand.id, formData);
      toast.success('Comando actualizado exitosamente');
      setEditingCommand(null);
      resetForm();
      loadCommands();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Error al actualizar comando');
    }
  };

  const handleDeleteCommand = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este comando?')) return;
    
    try {
      await api.deleteCustomCommand(id);
      toast.success('Comando eliminado');
      loadCommands();
    } catch (error) {
      toast.error('Error al eliminar comando');
    }
  };

  const handleToggleCommand = async (id: number, enabled: boolean) => {
    try {
      await api.updateCustomCommand(id, { enabled });
      toast.success(enabled ? 'Comando activado' : 'Comando desactivado');
      loadCommands();
    } catch (error) {
      toast.error('Error al cambiar estado del comando');
    }
  };

  const handleTestCommand = async (trigger: string) => {
    try {
      await api.testCustomCommand(trigger);
      toast.success('Comando ejecutado correctamente');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Error al probar comando');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      trigger: '',
      response: '',
      description: '',
      category: 'general',
      enabled: true
    });
  };

  const openEditModal = (command: CustomCommand) => {
    setEditingCommand(command);
    setFormData({
      name: command.name,
      trigger: command.trigger,
      response: command.response,
      description: command.description,
      category: command.category,
      enabled: command.enabled
    });
    setShowCreateModal(true);
  };

  const filteredCommands = commands.filter(command => {
    const matchesSearch = command.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         command.trigger.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         command.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || command.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-3xl font-bold text-white">Comandos Personalizados</h1>
          <p className="text-gray-400 mt-1">Crea y gestiona comandos personalizados para tu comunidad</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
          <AutoRefreshIndicator isActive={true} interval={120000} />
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
            Nuevo Comando
          </Button>
        </motion.div>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar comandos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-glass pl-10 w-full"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input-glass min-w-[150px]"
            >
              <option value="all">Todas las categorías</option>
              {COMMAND_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Commands Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-4 bg-white/10 rounded mb-4"></div>
              <div className="h-3 bg-white/5 rounded mb-2"></div>
              <div className="h-3 bg-white/5 rounded mb-4"></div>
              <div className="flex gap-2">
                <div className="h-8 bg-white/10 rounded flex-1"></div>
                <div className="h-8 bg-white/10 rounded w-16"></div>
              </div>
            </Card>
          ))
        ) : filteredCommands.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Code className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No hay comandos</h3>
            <p className="text-gray-400 mb-6">
              {searchTerm || selectedCategory !== 'all' 
                ? 'No se encontraron comandos con los filtros aplicados'
                : 'Crea tu primer comando personalizado para empezar'
              }
            </p>
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
              Crear Primer Comando
            </Button>
          </div>
        ) : (
          filteredCommands.map((command, index) => {
            const CategoryIcon = COMMAND_CATEGORIES.find(cat => cat.value === command.category)?.icon || Code;
            return (
              <motion.div
                key={command.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="p-6 hover:bg-white/5 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${command.enabled ? 'bg-primary-500/20 text-primary-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        <CategoryIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{command.name}</h3>
                        <p className="text-sm text-gray-400">/{command.trigger}</p>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      command.enabled 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {command.enabled ? 'Activo' : 'Inactivo'}
                    </div>
                  </div>

                  <p className="text-gray-300 text-sm mb-4 line-clamp-2">{command.description}</p>
                  
                  <div className="bg-white/5 rounded-lg p-3 mb-4">
                    <p className="text-xs text-gray-400 mb-1">Respuesta:</p>
                    <p className="text-sm text-white line-clamp-2">{command.response}</p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
                    <span>Usado {command.usage_count} veces</span>
                    <span>{new Date(command.created_at).toLocaleDateString()}</span>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Play className="w-3 h-3" />}
                      onClick={() => handleTestCommand(command.trigger)}
                      className="flex-1"
                    >
                      Probar
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Edit className="w-3 h-3" />}
                      onClick={() => openEditModal(command)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant={command.enabled ? "secondary" : "success"}
                      size="sm"
                      onClick={() => handleToggleCommand(command.id, !command.enabled)}
                    >
                      {command.enabled ? 'Desactivar' : 'Activar'}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<Trash2 className="w-3 h-3" />}
                      onClick={() => handleDeleteCommand(command.id)}
                    >
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })
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
                {editingCommand ? 'Editar Comando' : 'Crear Nuevo Comando'}
              </h2>
              <Button
                variant="secondary"
                size="sm"
                icon={<X className="w-4 h-4" />}
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingCommand(null);
                  resetForm();
                }}
              />
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Nombre del Comando *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Saludo de Bienvenida"
                    className="input-glass w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Trigger (sin /) *</label>
                  <input
                    type="text"
                    value={formData.trigger}
                    onChange={(e) => setFormData({ ...formData, trigger: e.target.value.replace('/', '') })}
                    placeholder="Ej: hola"
                    className="input-glass w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Categoría</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="input-glass w-full"
                >
                  {COMMAND_CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Descripción</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe qué hace este comando"
                  className="input-glass w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Respuesta del Bot *</label>
                <textarea
                  value={formData.response}
                  onChange={(e) => setFormData({ ...formData, response: e.target.value })}
                  placeholder="¡Hola! Bienvenido a nuestra comunidad 👋"
                  rows={4}
                  className="input-glass w-full resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Puedes usar variables como {'{usuario}'}, {'{grupo}'}, {'{fecha}'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="w-4 h-4 text-primary-500 bg-gray-700 border-gray-600 rounded focus:ring-primary-500"
                />
                <label htmlFor="enabled" className="text-sm text-gray-300">
                  Activar comando inmediatamente
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-6 border-t border-white/10">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingCommand(null);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                icon={<Save className="w-4 h-4" />}
                className="flex-1"
                onClick={editingCommand ? handleUpdateCommand : handleCreateCommand}
              >
                {editingCommand ? 'Actualizar' : 'Crear'} Comando
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}