'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  Play, 
  Pause, 
  Trash2, 
  Plus, 
  Edit, 
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  Settings,
  History,
  Filter,
  Search,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useSocket } from '@/contexts/SocketContext';
import api from '@/services/api';
import toast from 'react-hot-toast';

interface Task {
  id: string;
  name: string;
  description: string;
  type: string;
  action: string;
  schedule: string;
  enabled: boolean;
  priority: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  lastExecution?: TaskExecution;
  successCount: number;
  errorCount: number;
  createdAt: string;
}

interface TaskExecution {
  id: string;
  taskId: string;
  taskName: string;
  startTime: string;
  endTime?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  duration: number;
  manual: boolean;
  error?: string;
  result?: any;
}

export default function TareasPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [executions, setExecutions] = useState<TaskExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled' | 'running'>('all');
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showExecutions, setShowExecutions] = useState(false);

  const { socket } = useSocket();

  useEffect(() => {
    loadTasks();
    loadExecutions();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleTaskCreated = (data: any) => {
      if (!data?.task) return;
      setTasks(prev => {
        const exists = prev.some(t => String(t.id) === String(data.task.id));
        return exists ? prev : [data.task, ...prev];
      });
    };

    const handleTaskUpdate = (data: any) => {
      setTasks(prev => prev.map(task => 
        task.id === data.taskId ? { ...task, ...data.updates } : task
      ));
    };

    const handleTaskExecution = (data: TaskExecution) => {
      setExecutions(prev => {
        const id = String((data as any)?.id ?? '');
        const next = id ? prev.filter(e => String((e as any)?.id ?? '') !== id) : prev;
        return [data, ...next].slice(0, 100);
      });
      
      // Actualizar estado de la tarea
      setTasks(prev => prev.map(task => 
        task.id === data.taskId 
          ? { ...task, status: data.status, lastExecution: data }
          : task
      ));
    };

    const handleTaskDeleted = (data: any) => {
      const taskId = String(data?.taskId ?? '');
      if (!taskId) return;
      setTasks(prev => prev.filter(t => String(t.id) !== taskId));
      setExecutions(prev => prev.filter(e => String(e.taskId) !== taskId));
    };

    socket.on('task:created', handleTaskCreated);
    socket.on('task:updated', handleTaskUpdate);
    socket.on('task:executed', handleTaskExecution);
    socket.on('task:deleted', handleTaskDeleted);

    return () => {
      socket.off('task:created', handleTaskCreated);
      socket.off('task:updated', handleTaskUpdate);
      socket.off('task:executed', handleTaskExecution);
      socket.off('task:deleted', handleTaskDeleted);
    };
  }, [socket]);

  const loadTasks = async () => {
    try {
      setIsLoading(true);
      const data = await api.getTasks();
      const tasksList = (data as any)?.tasks || (data as any)?.data?.tasks || [];
      setTasks(Array.isArray(tasksList) ? tasksList : []);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setTasks([]);
      toast.error('Error cargando tareas');
    } finally {
      setIsLoading(false);
    }
  };

  const loadExecutions = async () => {
    try {
      const data = await api.getTaskExecutions(100);
      const list = (data as any)?.executions || (data as any)?.history || [];
      setExecutions(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Error loading executions:', error);
      setExecutions([]);
    }
  };

  const executeTask = async (taskId: string) => {
    try {
      await api.executeTask(taskId);
      await Promise.all([loadTasks(), loadExecutions()]);
      toast.success('Tarea ejecutada');
    } catch (error) {
      toast.error('Error ejecutando tarea');
    }
  };

  const toggleTask = async (taskId: string, enabled: boolean) => {
    try {
      await api.updateTask(taskId, { enabled });
      await loadTasks();
      toast.success(enabled ? 'Tarea habilitada' : 'Tarea pausada');
    } catch (error) {
      toast.error('Error actualizando tarea');
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta tarea?')) return;

    try {
      await api.deleteTask(taskId);
      await Promise.all([loadTasks(), loadExecutions()]);
      toast.success('Tarea eliminada');
    } catch (error) {
      toast.error('Error eliminando tarea');
    }
  };

  const filteredTasks = tasks.filter(task => {
    // Filtro por estado
    if (filter === 'enabled' && !task.enabled) return false;
    if (filter === 'disabled' && task.enabled) return false;
    if (filter === 'running' && task.status !== 'running') return false;

    // Filtro por búsqueda
    if (search) {
      const searchLower = search.toLowerCase();
      return task.name.toLowerCase().includes(searchLower) ||
             task.description.toLowerCase().includes(searchLower) ||
             task.type.toLowerCase().includes(searchLower);
    }

    return true;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Activity className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-400" />;
      case 'paused': return <Pause className="w-4 h-4 text-yellow-400" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-blue-400 bg-blue-500/20';
      case 'completed': return 'text-green-400 bg-green-500/20';
      case 'failed': return 'text-red-400 bg-red-500/20';
      case 'paused': return 'text-yellow-400 bg-yellow-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 4) return 'text-red-400';
    if (priority >= 3) return 'text-orange-400';
    if (priority >= 2) return 'text-yellow-400';
    return 'text-gray-400';
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  const formatSchedule = (schedule: string) => {
    // Convertir expresión cron a texto legible
    const parts = schedule.split(' ');
    if (parts.length !== 5) return schedule;

    const [minute, hour, day, month, weekday] = parts;
    
    if (schedule === '0 2 * * *') return 'Diario a las 2:00 AM';
    if (schedule === '0 */6 * * *') return 'Cada 6 horas';
    if (schedule === '*/15 * * * *') return 'Cada 15 minutos';
    if (schedule === '0 8 * * *') return 'Diario a las 8:00 AM';
    
    return schedule;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tareas Programadas</h1>
          <p className="text-gray-400">Gestiona tareas automáticas del sistema</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowExecutions(!showExecutions)}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <History className="w-4 h-4" />
            {showExecutions ? 'Ocultar' : 'Ver'} Historial
          </Button>
          
          <Button
            onClick={() => setShowCreateModal(true)}
            variant="primary"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nueva Tarea
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar tareas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-glass pl-10"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="input-glass min-w-[120px]"
            >
              <option value="all">Todas</option>
              <option value="enabled">Habilitadas</option>
              <option value="disabled">Deshabilitadas</option>
              <option value="running">En ejecución</option>
            </select>
          </div>
          
          <Button
            onClick={loadTasks}
            variant="secondary"
            loading={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Lista de tareas */}
      <div className="glass-card">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">
            Tareas ({filteredTasks.length})
          </h2>
        </div>
        
        <div className="divide-y divide-white/5">
          <AnimatePresence>
            {filteredTasks.length === 0 ? (
              <div className="p-8 text-center">
                <Clock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">
                  {tasks.length === 0 
                    ? 'No hay tareas programadas' 
                    : 'No se encontraron tareas con los filtros aplicados'
                  }
                </p>
              </div>
            ) : (
              filteredTasks.map((task) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="p-4 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(task.status)}
                          <h3 className="font-medium text-white">{task.name}</h3>
                        </div>
                        
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                          {task.status}
                        </span>
                        
                        <span className={`text-xs ${getPriorityColor(task.priority)}`}>
                          {'★'.repeat(task.priority)}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-400 mb-2">{task.description}</p>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatSchedule(task.schedule)}</span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <span>Tipo: {task.type}</span>
                        </div>
                        
                        {task.lastExecution && (
                          <div className="flex items-center gap-1">
                            <span>
                              Última: {formatDuration(task.lastExecution.duration)}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-green-400" />
                          <span>{task.successCount}</span>
                          <XCircle className="w-3 h-3 text-red-400 ml-2" />
                          <span>{task.errorCount}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        onClick={() => executeTask(task.id)}
                        variant="secondary"
                        size="sm"
                        disabled={task.status === 'running'}
                        className="flex items-center gap-1"
                      >
                        <Play className="w-3 h-3" />
                        Ejecutar
                      </Button>
                      
                      <Button
                        onClick={() => toggleTask(task.id, !task.enabled)}
                        variant="secondary"
                        size="sm"
                        className="flex items-center gap-1"
                      >
                        {task.enabled ? (
                          <>
                            <Pause className="w-3 h-3" />
                            Pausar
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3" />
                            Reanudar
                          </>
                        )}
                      </Button>
                      
                      <Button
                        onClick={() => setSelectedTask(task)}
                        variant="secondary"
                        size="sm"
                        className="flex items-center gap-1"
                      >
                        <Edit className="w-3 h-3" />
                        Editar
                      </Button>
                      
                      <Button
                        onClick={() => deleteTask(task.id)}
                        variant="secondary"
                        size="sm"
                        className="flex items-center gap-1 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-3 h-3" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Historial de ejecuciones */}
      <AnimatePresence>
        {showExecutions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card"
          >
            <div className="p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">
                Historial de Ejecuciones
              </h2>
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              {executions.length === 0 ? (
                <div className="p-8 text-center">
                  <History className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No hay ejecuciones registradas</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {executions.map((execution) => (
                    <div key={execution.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(execution.status)}
                          <div>
                            <p className="font-medium text-white">{execution.taskName}</p>
                            <p className="text-xs text-gray-400">
                              {new Date(execution.startTime).toLocaleString()}
                              {execution.manual && ' (Manual)'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-sm text-gray-300">
                            {formatDuration(execution.duration)}
                          </p>
                          {execution.error && (
                            <p className="text-xs text-red-400 max-w-xs truncate">
                              {execution.error}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
