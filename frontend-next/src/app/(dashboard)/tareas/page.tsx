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

  const tareasLanes = [
    {
      label: 'Total tareas',
      value: `${summary.total}`,
      description: summary.total > 0 ? 'Tareas registradas en el sistema.' : 'Sin tareas configuradas.',
      icon: <Activity className="w-4 h-4" />,
      badge: 'total',
      badgeClassName: 'border-white/10 bg-white/[0.05] text-white/70',
      glowClassName: 'from-[rgb(var(--page-a))]/18 via-oguri-cyan/10 to-transparent',
    },
    {
      label: 'Habilitadas',
      value: `${summary.enabled}`,
      description: summary.enabled > 0 ? 'Tareas activas en espera de ejecución.' : 'Ninguna tarea habilitada.',
      icon: <CheckCircle className="w-4 h-4" />,
      badge: summary.enabled > 0 ? 'on' : 'off',
      badgeClassName: summary.enabled > 0 ? 'border-[rgb(var(--success))]/20 bg-[rgb(var(--success))]/10 text-[#c7f9d8]' : 'border-white/10 bg-white/[0.05] text-white/70',
      glowClassName: 'from-[rgb(var(--success))]/18 via-oguri-cyan/10 to-transparent',
    },
    {
      label: 'Ejecutando',
      value: `${summary.running}`,
      description: summary.running > 0 ? 'Tareas en progreso ahora mismo.' : 'No hay ejecuciones activas.',
      icon: <Play className="w-4 h-4" />,
      badge: summary.running > 0 ? 'live' : 'idle',
      badgeClassName: summary.running > 0 ? 'border-oguri-cyan/20 bg-oguri-cyan/10 text-oguri-cyan' : 'border-white/10 bg-white/[0.05] text-white/70',
      glowClassName: 'from-oguri-cyan/18 via-oguri-blue/10 to-transparent',
    },
    {
      label: 'Con errores',
      value: `${summary.failed}`,
      description: summary.failed > 0 ? 'Tareas que fallaron en su última ejecución.' : 'Sin errores detectados.',
      icon: <XCircle className="w-4 h-4" />,
      badge: summary.failed > 0 ? 'err' : 'ok',
      badgeClassName: summary.failed > 0 ? 'border-danger/20 bg-danger/10 text-danger/80' : 'border-[rgb(var(--success))]/20 bg-[rgb(var(--success))]/10 text-[#c7f9d8]',
      glowClassName: summary.failed > 0 ? 'from-danger/14 via-red-900/10 to-transparent' : 'from-[rgb(var(--success))]/10 to-transparent',
    },
  ];

  return (
    <div className="panel-page relative overflow-hidden">
      {/* Ambient atmosphere */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[-8%] top-[-4rem] -z-10 h-[420px] overflow-hidden">
        <div className="module-atmosphere" />
        {!reduceMotion && (
          <>
            <motion.div
              className="absolute left-[8%] top-[12%] h-52 w-52 rounded-full bg-info/16 blur-3xl"
              animate={{ x: [0, 18, 0], y: [0, 14, 0], opacity: [0.16, 0.34, 0.16] }}
              transition={{ repeat: Infinity, duration: 11, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute right-[10%] top-[10%] h-56 w-56 rounded-full bg-[rgb(var(--success))]/14 blur-3xl"
              animate={{ x: [0, -16, 0], y: [0, 18, 0], opacity: [0.14, 0.32, 0.14] }}
              transition={{ repeat: Infinity, duration: 12.5, ease: 'easeInOut', delay: 0.5 }}
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
              <Settings className="h-3.5 w-3.5 text-info/80" />
              Motor de tareas
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Tareas del sistema</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-gray-300">
              Automatizaciones programadas que se ejecutan en segundo plano. Monitorea su estado en tiempo real.
            </p>
          </div>
          <div className="panel-hero-meta-grid">
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Total</p>
              <p className="mt-2 text-lg font-black text-white">{summary.total}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Activas</p>
              <p className="mt-2 text-lg font-black text-[#c7f9d8]">{summary.enabled}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Errores</p>
              <p className="mt-2 text-lg font-black text-danger">{summary.failed}</p>
            </div>
          </div>
        </div>
      </motion.div>

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

      {/* Lane cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {tareasLanes.map((lane, index) => (
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
