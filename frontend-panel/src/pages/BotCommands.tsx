import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Search,
  Plus,
  Edit,
  Trash2,
  Play,
  Copy,
  Terminal,
  CheckCircle,
  XCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Clock,
  BarChart3,
  HelpCircle,
  MessageSquare,
  Zap,
  Shield,
  Tag,
  Upload,
  Settings,
  AlertCircle
} from 'lucide-react';
import { AnimatedCard, StatCard } from '../components/ui/AnimatedCard';
import { AnimatedButton, IconButton } from '../components/ui/AnimatedButton';
import { CustomSelect } from '../components/ui/CustomSelect';

interface BotCommand {
  id: string;
  command: string;
  description: string;
  response: string;
  category: string;
  enabled: boolean;
  usage_count: number;
  last_used?: string;
  created_at: string;
  updated_at: string;
  permissions: string[];
  aliases: string[];
}

interface CommandCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  command_count: number;
}

const BotCommands: React.FC = () => {
  const [commands, setCommands] = useState<BotCommand[]>([]);
  const [categories, setCategories] = useState<CommandCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCommand, setSelectedCommand] = useState<BotCommand | null>(null);
  const [showCommandModal, setShowCommandModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadCommands();
    loadCategories();
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const loadCommands = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/bot/commands');
      if (response.ok) {
        const data = await response.json();
        setCommands(data.commands || []);
        setError(null);
      } else {
        setError('Error al cargar comandos');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/bot/commands/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error('Error cargando categorías:', err);
    }
  };

  const createCommand = async (commandData: Partial<BotCommand>) => {
    try {
      setActionLoading('create');
      const response = await fetch('/api/bot/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commandData)
      });
      if (response.ok) {
        setSuccess('Comando creado exitosamente');
        setShowCommandModal(false);
        await loadCommands();
      } else {
        setError('Error al crear comando');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setActionLoading(null);
    }
  };

  const updateCommand = async (id: string, commandData: Partial<BotCommand>) => {
    try {
      setActionLoading('update');
      const response = await fetch(`/api/bot/commands/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commandData)
      });
      if (response.ok) {
        setSuccess('Comando actualizado exitosamente');
        setShowCommandModal(false);
        await loadCommands();
      } else {
        setError('Error al actualizar comando');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setActionLoading(null);
    }
  };

  const deleteCommand = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este comando?')) return;
    try {
      setActionLoading(id);
      const response = await fetch(`/api/bot/commands/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setSuccess('Comando eliminado exitosamente');
        await loadCommands();
      } else {
        setError('Error al eliminar comando');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleCommand = async (id: string, enabled: boolean) => {
    try {
      setActionLoading(id);
      const response = await fetch(`/api/bot/commands/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      if (response.ok) {
        setSuccess(`Comando ${enabled ? 'habilitado' : 'deshabilitado'} exitosamente`);
        await loadCommands();
      } else {
        setError('Error al cambiar estado del comando');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setActionLoading(null);
    }
  };

  const testCommand = async (command: string, message: string) => {
    try {
      setActionLoading('test');
      const response = await fetch('/api/bot/commands/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, message })
      });
      if (response.ok) {
        const data = await response.json();
        setTestResult(data.response);
        setSuccess('Comando probado exitosamente');
      } else {
        setError('Error al probar comando');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setActionLoading(null);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      general: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      admin: 'bg-red-500/20 text-red-400 border-red-500/30',
      fun: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      utility: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      info: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      subbot: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
      media: 'bg-pink-500/20 text-pink-400 border-pink-500/30'
    };
    return colors[category] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: React.ReactNode } = {
      general: <HelpCircle className="w-4 h-4" />,
      admin: <Shield className="w-4 h-4" />,
      fun: <Zap className="w-4 h-4" />,
      utility: <Settings className="w-4 h-4" />,
      info: <MessageSquare className="w-4 h-4" />,
      subbot: <Bot className="w-4 h-4" />,
      media: <Upload className="w-4 h-4" />
    };
    return icons[category] || <Tag className="w-4 h-4" />;
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copiado al portapapeles');
  };

  const filteredCommands = commands.filter((command) => {
    const matchesSearch = command.command.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         command.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || command.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const stats = {
    total: commands.length,
    active: commands.filter(c => c.enabled).length,
    todayUsage: commands.reduce((sum, c) => sum + c.usage_count, 0),
    categories: categories.length
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
                <Terminal className="w-8 h-8 text-blue-400" />
              </div>
              Comandos del Bot
            </h1>
            <p className="text-gray-400 mt-2">Gestiona los comandos disponibles para el bot de WhatsApp</p>
          </div>
          <div className="flex gap-3">
            <AnimatedButton
              onClick={loadCommands}
              loading={loading}
              variant="secondary"
              icon={<RefreshCw className="w-4 h-4" />}
            >
              Actualizar
            </AnimatedButton>
            <AnimatedButton
              onClick={() => { setSelectedCommand(null); setIsEditing(false); setShowCommandModal(true); }}
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
            >
              Nuevo Comando
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
          <StatCard title="Total Comandos" value={stats.total} icon={<Terminal className="w-6 h-6" />} color="info" delay={0} />
          <StatCard title="Activos" value={stats.active} icon={<CheckCircle className="w-6 h-6" />} color="success" delay={0.1} />
          <StatCard title="Usos Totales" value={stats.todayUsage} icon={<BarChart3 className="w-6 h-6" />} color="violet" delay={0.2} />
          <StatCard title="Categorías" value={stats.categories} icon={<Tag className="w-6 h-6" />} color="cyan" delay={0.3} />
        </div>

        {/* Filtros */}
        <AnimatedCard delay={0.2} className="p-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar comandos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-800/80 border border-white/10 rounded-xl text-gray-100 placeholder-gray-400 focus:border-blue-500/50 transition-all"
              />
            </div>
            <CustomSelect
              value={selectedCategory}
              onChange={setSelectedCategory}
              options={[
                { value: 'all', label: 'Todas las categorías' },
                ...categories.map((category) => ({
                  value: category.id,
                  label: category.name
                }))
              ]}
              placeholder="Filtrar por categoría"
            />
          </div>
        </AnimatedCard>

        {/* Lista */}
        <AnimatedCard delay={0.3} className="overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-xl font-semibold text-white">Lista de Comandos</h2>
            <p className="text-gray-400 mt-1">{filteredCommands.length} comando{filteredCommands.length !== 1 ? 's' : ''} encontrado{filteredCommands.length !== 1 ? 's' : ''}</p>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Cargando comandos...</p>
            </div>
          ) : filteredCommands.length === 0 ? (
            <div className="p-8 text-center">
              <Terminal className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No hay comandos</h3>
              <p className="text-gray-400">Crea tu primer comando para comenzar</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredCommands.map((command, index) => (
                <motion.div
                  key={command.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-6 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        {command.enabled ? (
                          <CheckCircle className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-gray-500" />
                        )}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                          command.enabled ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                        }`}>
                          {command.enabled ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(command.category)}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getCategoryColor(command.category)}`}>
                          {command.category}
                        </span>
                      </div>
                      <code className="bg-white/10 px-3 py-1 rounded-lg text-sm font-mono text-cyan-400">
                        {command.command}
                      </code>
                      <span className="text-sm text-gray-400 max-w-md truncate">{command.description}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <BarChart3 className="w-4 h-4" />
                          {command.usage_count} usos
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {command.last_used ? getTimeAgo(command.last_used) : 'Nunca'}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <IconButton
                          icon={<Play className="w-4 h-4" />}
                          onClick={() => { setSelectedCommand(command); setTestMessage(''); setTestResult(null); setShowTestModal(true); }}
                          variant="ghost"
                          tooltip="Probar"
                        />
                        <IconButton
                          icon={<Edit className="w-4 h-4" />}
                          onClick={() => { setSelectedCommand(command); setIsEditing(true); setShowCommandModal(true); }}
                          variant="ghost"
                          tooltip="Editar"
                        />
                        <IconButton
                          icon={command.enabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          onClick={() => toggleCommand(command.id, !command.enabled)}
                          loading={actionLoading === command.id}
                          variant="ghost"
                          tooltip={command.enabled ? 'Deshabilitar' : 'Habilitar'}
                        />
                        <IconButton
                          icon={<Trash2 className="w-4 h-4" />}
                          onClick={() => deleteCommand(command.id)}
                          loading={actionLoading === command.id}
                          variant="danger"
                          tooltip="Eliminar"
                        />
                      </div>
                    </div>
                  </div>
                  {command.aliases.length > 0 && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-gray-500">Aliases:</span>
                      <div className="flex gap-1">
                        {command.aliases.map((alias, i) => (
                          <span key={i} className="px-2 py-1 bg-white/5 text-gray-400 text-xs rounded">{alias}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </AnimatedCard>

        {/* Modal Comando */}
        <AnimatePresence>
          {showCommandModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowCommandModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="glass-card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-xl font-semibold text-white mb-6">
                  {isEditing ? 'Editar Comando' : 'Nuevo Comando'}
                </h3>
                <CommandForm
                  command={selectedCommand}
                  onSubmit={isEditing ? (data) => updateCommand(selectedCommand!.id, data) : createCommand}
                  isLoading={actionLoading === 'create' || actionLoading === 'update'}
                  onCancel={() => setShowCommandModal(false)}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Test */}
        <AnimatePresence>
          {showTestModal && selectedCommand && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowTestModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="glass-card p-6 w-full max-w-md"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-xl font-semibold text-white mb-4">Probar Comando</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Comando</label>
                    <code className="block p-3 bg-white/5 rounded-xl text-cyan-400 font-mono">{selectedCommand.command}</code>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Descripción</label>
                    <p className="text-sm text-gray-300">{selectedCommand.description}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Mensaje de prueba</label>
                    <textarea
                      placeholder="Escribe un mensaje de prueba..."
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-800/80 border border-white/10 rounded-xl text-gray-100 placeholder-gray-400 focus:border-blue-500/50 transition-all"
                      rows={3}
                    />
                  </div>
                  {testResult && (
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Resultado</label>
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                        <p className="text-sm text-emerald-400">{testResult}</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 mt-6">
                  <AnimatedButton onClick={() => setShowTestModal(false)} variant="secondary" fullWidth>
                    Cancelar
                  </AnimatedButton>
                  <AnimatedButton
                    onClick={() => testCommand(selectedCommand.command, testMessage)}
                    loading={actionLoading === 'test'}
                    disabled={!testMessage.trim()}
                    variant="primary"
                    fullWidth
                  >
                    Probar
                  </AnimatedButton>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const CommandForm: React.FC<{
  command?: BotCommand | null;
  onSubmit: (data: Partial<BotCommand>) => void;
  isLoading: boolean;
  onCancel: () => void;
}> = ({ command, onSubmit, isLoading, onCancel }) => {
  const [formData, setFormData] = useState({
    command: command?.command || '',
    description: command?.description || '',
    response: command?.response || '',
    category: command?.category || 'general',
    enabled: command?.enabled ?? true,
    permissions: command?.permissions || [],
    aliases: command?.aliases || [],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm text-gray-400 mb-1 block">Comando *</label>
        <input
          type="text"
          value={formData.command}
          onChange={(e) => setFormData({ ...formData, command: e.target.value })}
          placeholder="ej: /help"
          className="w-full px-4 py-2.5 bg-gray-800/80 border border-white/10 rounded-xl text-gray-100 placeholder-gray-400 focus:border-blue-500/50 transition-all"
          required
        />
      </div>
      <div>
        <label className="text-sm text-gray-400 mb-1 block">Descripción *</label>
        <input
          type="text"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Descripción del comando"
          className="w-full px-4 py-2.5 bg-gray-800/80 border border-white/10 rounded-xl text-gray-100 placeholder-gray-400 focus:border-blue-500/50 transition-all"
          required
        />
      </div>
      <div>
        <label className="text-sm text-gray-400 mb-1 block">Respuesta *</label>
        <textarea
          value={formData.response}
          onChange={(e) => setFormData({ ...formData, response: e.target.value })}
          placeholder="Respuesta del bot"
          rows={4}
          className="w-full px-4 py-2.5 bg-gray-800/80 border border-white/10 rounded-xl text-gray-100 placeholder-gray-400 focus:border-blue-500/50 transition-all"
          required
        />
      </div>
      <div>
        <label className="text-sm text-gray-400 mb-1 block">Categoría</label>
        <CustomSelect
          value={formData.category}
          onChange={(value) => setFormData({ ...formData, category: value })}
          options={[
            { value: 'general', label: 'General' },
            { value: 'admin', label: 'Administración' },
            { value: 'fun', label: 'Diversión' },
            { value: 'utility', label: 'Utilidades' },
            { value: 'info', label: 'Información' },
            { value: 'subbot', label: 'Subbots' },
            { value: 'media', label: 'Multimedia' }
          ]}
          placeholder="Seleccionar categoría"
        />
      </div>
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="enabled"
          checked={formData.enabled}
          onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
          className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/50"
        />
        <label htmlFor="enabled" className="text-sm text-gray-400">Habilitado</label>
      </div>
      <div className="flex gap-3">
        <AnimatedButton type="button" onClick={onCancel} variant="secondary" fullWidth>
          Cancelar
        </AnimatedButton>
        <AnimatedButton type="submit" loading={isLoading} variant="primary" fullWidth>
          Guardar
        </AnimatedButton>
      </div>
    </form>
  );
};

export default BotCommands;
