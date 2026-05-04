'use client';
import { getErrorMessage } from '@/lib/utils';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
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
import { Card, CardContent, CardHeader, CardTitle, StatCard } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { Reveal } from '@/components/motion/Reveal';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { useSocketConnection } from '@/contexts/SocketContext';
import { useFlashTokens } from '@/hooks/useFlashTokens';
import api from '@/services/api';
import { notify } from '@/lib/notif';

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

  const { socket } = useSocketConnection();
  const reduceMotion = useReducedMotion();
  const taskFlash = useFlashTokens({ ttlMs: 1200 });
  const executionFlash = useFlashTokens({ ttlMs: 1200 });

  useEffect(() => {
    loadTasks();
    loadExecutions();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleTaskCreated = (data: any) => {
      if (!data?.task) return;
      taskFlash.trigger(String(data.task.id));
      setTasks(prev => {
        const exists = prev.some(t => String(t.id) === String(data.task.id));
        return exists ? prev : [data.task, ...prev];
      });
    };

    const handleTaskUpdate = (data: any) => {
      if (data?.taskId) taskFlash.trigger(String(data.taskId));
      setTasks(prev => prev.map(task => 
        task.id === data.taskId ? { ...task, ...data.updates } : task
      ));
    };

    const handleTaskExecution = (data: TaskExecution) => {
      executionFlash.trigger(String((data as any)?.id ?? `${data.taskId}:${data.startTime ?? Date.now()}`));
      taskFlash.trigger(String(data.taskId));
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
  }, [executionFlash, socket, taskFlash]);

  const loadTasks = async () => {
    try {
      setIsLoading(true);
      const data = await api.getTasks();
      const tasksList = (data as any)?.tasks || (data as any)?.data?.tasks || [];
      setTasks(Array.isArray(tasksList) ? tasksList : []);
    } catch (error) {
      console.error('Error loading tasks:', getErrorMessage(error));
      setTasks([]);
      notify.error('Error cargando tareas');
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
      console.error('Error loading executions:', getErrorMessage(error));
      setExecutions([]);
    }
  };

  const executeTask = async (taskId: string) => {
    try {
      await api.executeTask(taskId);
      await Promise.all([loadTasks(), loadExecutions()]);
      notify.success('Tarea ejecutada');
    } catch (error) {
      notify.error('Error ejecutando tarea');
    }
  };

  const toggleTask = async (taskId: string, enabled: boolean) => {
    try {
      await api.updateTask(taskId, { enabled });
      await loadTasks();
      notify.success(enabled ? 'Tarea habilitada' : 'Tarea pausada');
    } catch (error) {
      notify.error('Error actualizando tarea');
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta tarea?')) return;

    try {
      await api.deleteTask(taskId);
      await Promise.all([loadTasks(), loadExecutions()]);
      notify.success('Tarea eliminada');
    } catch (error) {
      notify.error('Error eliminando tarea');
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

  const summary = React.useMemo(() => {
    let enabled = 0;
    let running = 0;
    let failed = 0;

    for (const task of tasks) {
      if (task.enabled) enabled += 1;
      if (task.status === 'running') running += 1;
      if (task.status === 'failed') failed += 1;
    }

    return { total: tasks.length, enabled, running, failed };
  }, [tasks]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Activity className="w-4 h-4 text-info animate-spin" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-success" />;
      case 'failed': return <XCircle className="w-4 h-4 text-danger" />;
      case 'paused': return <Pause className="w-4 h-4 text-warning" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-info bg-info/20';
      case 'completed': return 'text-success bg-success/20';
      case 'failed': return 'text-danger bg-danger/20';
      case 'paused': return 'text-warning bg-warning/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 4) return 'text-danger';
    if (priority >= 3) return 'text-orange-400';
    if (priority >= 2) return 'text-warning';
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

  const listVariants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.04,
      },
    },
  };

  const itemVariants = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 },
    show: reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 },
    exit: reduceMotion ? { opacity: 0 } : { opacity: 0, y: -14 },
  };

  return (
    <div className="panel-page">
      {/* Header */}
      <PageHeader
        title="Tareas Programadas"
        description="Gestiona tareas automáticas del sistema"
        icon={<Calendar className="w-5 h-5 text-primary-400" />}
        actions={
          <>
            <Button
              onClick={() => setShowExecutions(!showExecutions)}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <History className="w-4 h-4" />
              {showExecutions ? 'Ocultar' : 'Ver'} Historial
            </Button>

            <Button onClick={() => setShowCreateModal(true)} variant="primary" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Nueva Tarea
            </Button>
          </>
        }
      />

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" delay={0.02} stagger={0.07}>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <StatCard title="Total" value={summary.total} icon={<Activity className="w-6 h-6" />} color="info" delay={0} animated={false} />
        </StaggerItem>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <StatCard
            title="Habilitadas"
            value={summary.enabled}
            icon={<CheckCircle className="w-6 h-6" />}
            color="success"
            delay={0}
            animated={false}
          />
        </StaggerItem>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <StatCard
            title="En ejecución"
            value={summary.running}
            icon={<Activity className="w-6 h-6" />}
            color="warning"
            delay={0}
            animated={false}
          />
        </StaggerItem>
        <StaggerItem whileHover={{ y: -8, scale: 1.015, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <StatCard
            title="Fallidas"
            value={summary.failed}
            icon={<AlertTriangle className="w-6 h-6" />}
            color="danger"
            delay={0}
            animated={false}
          />
        </StaggerItem>
      </Stagger>

      {/* Filtros */}
      <Reveal>
        <Card>
          <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  placeholder="Buscar tareas..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input-glass pl-10"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-border/15 bg-card/60 px-3 py-2">
              <Filter className="w-4 h-4 text-muted" />
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

            <Button onClick={loadTasks} variant="secondary" loading={isLoading} className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Actualizar
            </Button>
          </div>
          </CardContent>
        </Card>
      </Reveal>

      {/* Lista de tareas */}
      <Reveal>
        <Card>
          <CardHeader>
            <CardTitle>
              Tareas (<AnimatedNumber value={filteredTasks.length} />)
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            <motion.div variants={listVariants} initial="hidden" animate="show" className="divide-y divide-border/10">
              <AnimatePresence mode="popLayout">
              {isLoading && tasks.length === 0 ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={`sk-${i}`} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-3">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-4 w-4 rounded" />
                          <Skeleton className="h-4 w-44 rounded" />
                          <Skeleton className="h-5 w-20 rounded-full" />
                        </div>
                        <Skeleton className="h-3 w-full rounded" />
                        <Skeleton className="h-3 w-2/3 rounded" />
                        <div className="flex items-center gap-4">
                          <Skeleton className="h-3 w-28 rounded" />
                          <Skeleton className="h-3 w-20 rounded" />
                          <Skeleton className="h-3 w-24 rounded" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-8 w-20 rounded-lg" />
                        <Skeleton className="h-8 w-20 rounded-lg" />
                        <Skeleton className="h-8 w-20 rounded-lg" />
                      </div>
                    </div>
                  </div>
                ))
              ) : filteredTasks.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Clock className="w-6 h-6 text-muted" />}
                  title={tasks.length === 0 ? 'No hay tareas programadas' : 'Sin resultados'}
                  description={tasks.length === 0 ? 'No hay tareas programadas' : 'No se encontraron tareas con los filtros aplicados'}
                />
              </div>
            ) : (
              filteredTasks.map((task) => (
                <motion.div
                  key={task.id}
                  layout="position"
                  variants={itemVariants}
                  exit="exit"
                  className="relative overflow-hidden p-4 transition-colors hover:bg-card/55"
                >
                  {taskFlash.tokens[String(task.id)] && (
                    <div
                      key={taskFlash.tokens[String(task.id)]}
                      className="flash-update pointer-events-none absolute inset-0"
                    />
                  )}
                  <div className="relative flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(task.status)}
                          <h3 className="font-medium text-foreground">{task.name}</h3>
                        </div>
                        
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                          {task.status}
                        </span>
                        
                        <span className={`text-xs ${getPriorityColor(task.priority)}`}>
                          {'★'.repeat(task.priority)}
                        </span>
                      </div>
                      
                      <p className="mb-2 text-sm text-muted">{task.description}</p>
                      
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
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
                          <CheckCircle className="w-3 h-3 text-success" />
                          <span>
                            <AnimatedNumber value={task.successCount} />
                          </span>
                          <XCircle className="w-3 h-3 text-danger ml-2" />
                          <span>
                            <AnimatedNumber value={task.errorCount} />
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="panel-actions-wrap xl:justify-end">
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
                        className="flex items-center gap-1 text-danger hover:text-danger/80"
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
            </motion.div>
          </CardContent>
        </Card>
      </Reveal>

      {/* Historial de ejecuciones */}
      <AnimatePresence>
        {showExecutions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="panel-editor-shell"
          >
            <div className="border-b border-border/15 p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-foreground">
                Historial de Ejecuciones
              </h2>
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              {executions.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={<History className="w-6 h-6 text-muted" />}
                    title="No hay ejecuciones registradas"
                    description="El historial aparecerá aquí cuando corran tareas."
                  />
                </div>
              ) : (
                <div>
                  <motion.div variants={listVariants} initial="hidden" animate="show" className="divide-y divide-border/10">
                    <AnimatePresence mode="popLayout">
                      {executions.map((execution) => (
                        <motion.div
                          key={execution.id}
                          layout="position"
                          variants={itemVariants}
                          exit="exit"
                          className="relative overflow-hidden p-4"
                        >
                          {executionFlash.tokens[String(execution.id)] && (
                            <div
                              key={executionFlash.tokens[String(execution.id)]}
                              className="flash-update pointer-events-none absolute inset-0"
                            />
                          )}
                          <div className="relative flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              {getStatusIcon(execution.status)}
                              <div>
                                <p className="font-medium text-foreground">{execution.taskName}</p>
                                <p className="text-xs text-muted">
                                  {new Date(execution.startTime).toLocaleString()}
                                  {execution.manual && ' (Manual)'}
                                </p>
                              </div>
                            </div>
                             
                            <div className="text-right">
                              <p className="text-sm text-[rgb(var(--text-secondary))]">
                                {formatDuration(execution.duration)}
                              </p>
                              {execution.error && (
                                <p className="text-xs text-danger max-w-xs truncate">
                                  {execution.error}
                                </p>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </motion.div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
