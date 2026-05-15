'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Puzzle, Search, Power, PowerOff, Tag, ChevronDown,
  RotateCw, AlertCircle, CheckCircle2, Terminal, X, Filter, Zap
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Reveal } from '@/components/motion/Reveal';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { notify } from '@/lib/notif';
import api from '@/services/api';

interface Plugin {
  name: string;
  label: string;
  disabled: boolean;
  message: string | null;
  disabledAt: string | null;
  tags: string[];
  help: string[];
}

// Normalize tags: merge duplicates like 'download'/'downloader'/'descargas'
const TAG_ALIASES: Record<string, string> = {
  downloader: 'download',
  descargas: 'download',
  economía: 'economy',
  grupo: 'group',
  rg: 'rpg',
};

const TAG_LABELS: Record<string, string> = {
  anime: 'Anime',
  download: 'Descargas',
  economy: 'Economía',
  fun: 'Fun',
  gacha: 'Gacha',
  github: 'GitHub',
  group: 'Grupos',
  info: 'Info',
  main: 'Principal',
  mods: 'Mods',
  nable: 'N-able',
  nsfw: 'NSFW',
  owner: 'Owner',
  profile: 'Perfil',
  rpg: 'RPG',
  search: 'Búsqueda',
  serbot: 'SerBot',
  socket: 'Socket',
  sticker: 'Stickers',
  tools: 'Herramientas',
  panel: 'Panel',
};

const TAG_COLORS: Record<string, string> = {
  anime: 'bg-pink-500/15 text-pink-300 border-pink-500/20',
  download: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
  economy: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20',
  fun: 'bg-orange-500/15 text-orange-300 border-orange-500/20',
  gacha: 'bg-purple-500/15 text-purple-300 border-purple-500/20',
  github: 'bg-slate-500/15 text-slate-300 border-slate-500/20',
  group: 'bg-green-500/15 text-green-300 border-green-500/20',
  info: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/20',
  main: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  mods: 'bg-rose-500/15 text-rose-300 border-rose-500/20',
  nable: 'bg-red-500/15 text-red-300 border-red-500/20',
  nsfw: 'bg-red-600/15 text-red-300 border-red-600/20',
  owner: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  profile: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/20',
  rpg: 'bg-violet-500/15 text-violet-300 border-violet-500/20',
  search: 'bg-teal-500/15 text-teal-300 border-teal-500/20',
  serbot: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/20',
  socket: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
  sticker: 'bg-lime-500/15 text-lime-300 border-lime-500/20',
  tools: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/20',
  panel: 'bg-primary/15 text-primary/80 border-primary/20',
};

function normalizeTag(t: string) {
  const lower = t.toLowerCase().trim();
  return TAG_ALIASES[lower] ?? lower;
}

function getAllTags(plugins: Plugin[]): string[] {
  const set = new Set<string>();
  for (const p of plugins) {
    for (const t of p.tags) set.add(normalizeTag(t));
  }
  return Array.from(set).sort();
}

// ── Disable reason modal ─────────────────────────────────────────────────────
function DisableModal({
  plugin,
  onConfirm,
  onClose,
}: {
  plugin: Plugin;
  onConfirm: (message: string) => void;
  onClose: () => void;
}) {
  const [msg, setMsg] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-[22px] border border-white/10 bg-[#0e1210]/95 p-6 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-danger/50 to-transparent" />
        <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1.5 text-muted hover:bg-white/[0.06] hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-danger/20 bg-danger/10">
            <PowerOff className="h-5 w-5 text-danger" />
          </div>
          <div>
            <p className="text-sm font-black text-foreground">Desactivar plugin</p>
            <p className="text-xs text-muted font-mono">{plugin.label}</p>
          </div>
        </div>
        <p className="mb-3 text-xs text-[rgb(var(--text-secondary))]">
          Mensaje para los usuarios (opcional). Aparecerá cuando intenten usar este comando.
        </p>
        <textarea
          value={msg}
          onChange={e => setMsg(e.target.value)}
          placeholder="Ej: Comando temporalmente desactivado por mantenimiento..."
          rows={3}
          className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-danger/40 focus:outline-none focus:ring-1 focus:ring-danger/20"
        />
        <div className="mt-4 flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-sm font-semibold text-muted hover:bg-white/[0.07] hover:text-foreground transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(msg.trim())}
            className="flex-1 rounded-xl border border-danger/20 bg-danger/10 py-2.5 text-sm font-bold text-danger hover:bg-danger/20 transition-all"
          >
            Desactivar
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Plugin card ──────────────────────────────────────────────────────────────
function PluginCard({
  plugin,
  isAdmin,
  onToggle,
  toggling,
}: {
  plugin: Plugin;
  isAdmin: boolean;
  onToggle: (plugin: Plugin, disabled: boolean, message?: string) => void;
  toggling: boolean;
}) {
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const normTags = useMemo(() => [...new Set(plugin.tags.map(normalizeTag))], [plugin.tags]);

  function handleToggle() {
    if (toggling) return;
    if (!plugin.disabled) {
      setShowDisableModal(true);
    } else {
      onToggle(plugin, false);
    }
  }

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          'group relative overflow-hidden rounded-[18px] border transition-all duration-300',
          plugin.disabled
            ? 'border-danger/20 bg-danger/[0.04] hover:border-danger/30'
            : 'border-white/8 bg-white/[0.028] hover:border-white/14 hover:bg-white/[0.042]'
        )}
      >
        {/* Left accent bar */}
        <div
          className={cn(
            'absolute inset-y-0 left-0 w-[3px] rounded-r-full transition-all',
            plugin.disabled ? 'bg-danger/60' : 'bg-primary/40 opacity-0 group-hover:opacity-100'
          )}
        />

        {/* Disabled overlay glow */}
        {plugin.disabled && (
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(var(--danger),0.06),transparent_60%)]" />
        )}

        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all',
              plugin.disabled
                ? 'border-danger/20 bg-danger/10 text-danger/70'
                : 'border-white/10 bg-white/[0.05] text-[rgb(var(--text-secondary))] group-hover:border-primary/20 group-hover:text-primary/80'
            )}>
              <Puzzle className="h-4 w-4" />
            </div>

            {/* Name + tags */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={cn(
                  'font-mono text-sm font-bold tracking-tight',
                  plugin.disabled ? 'text-muted line-through' : 'text-foreground'
                )}>
                  {plugin.label}
                </span>
                {plugin.disabled && (
                  <span className="rounded-full border border-danger/20 bg-danger/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-danger">
                    OFF
                  </span>
                )}
              </div>

              <div className="mt-1.5 flex flex-wrap gap-1">
                {normTags.map(tag => (
                  <span
                    key={tag}
                    className={cn(
                      'rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                      TAG_COLORS[tag] ?? 'bg-white/[0.06] text-muted border-white/10'
                    )}
                  >
                    {TAG_LABELS[tag] ?? tag}
                  </span>
                ))}
              </div>

              {/* Disable reason */}
              {plugin.disabled && plugin.message && (
                <p className="mt-2 text-[11px] leading-snug text-danger/70 italic">
                  &ldquo;{plugin.message}&rdquo;
                </p>
              )}
            </div>

            {/* Toggle */}
            {isAdmin && (
              <button
                onClick={handleToggle}
                disabled={toggling}
                title={plugin.disabled ? 'Activar plugin' : 'Desactivar plugin'}
                className={cn(
                  'relative flex h-8 w-14 shrink-0 items-center rounded-full border transition-all duration-300',
                  toggling && 'opacity-50 cursor-wait',
                  plugin.disabled
                    ? 'border-danger/25 bg-danger/10 justify-start pl-1'
                    : 'border-primary/25 bg-primary/10 justify-end pr-1',
                )}
              >
                <motion.span
                  layout
                  transition={{ type: 'spring', stiffness: 600, damping: 36 }}
                  className={cn(
                    'h-5 w-5 rounded-full border shadow-sm',
                    plugin.disabled
                      ? 'border-danger/30 bg-danger/70'
                      : 'border-primary/30 bg-primary'
                  )}
                />
              </button>
            )}
          </div>

          {/* Commands — expandable */}
          {plugin.help.length > 0 && (
            <div className="mt-3 border-t border-white/[0.06] pt-2.5">
              <button
                onClick={() => setExpanded(v => !v)}
                className="flex w-full items-center gap-1.5 text-left"
              >
                <Terminal className="h-3 w-3 shrink-0 text-muted" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  {plugin.help.length} comando{plugin.help.length !== 1 ? 's' : ''}
                </span>
                <ChevronDown className={cn('ml-auto h-3 w-3 text-muted transition-transform', expanded && 'rotate-180')} />
              </button>
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 flex flex-wrap gap-1">
                      {plugin.help.map(cmd => (
                        <code
                          key={cmd}
                          className="rounded-md border border-white/8 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-[rgb(var(--text-secondary))]"
                        >
                          .{cmd}
                        </code>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {showDisableModal && (
          <DisableModal
            plugin={plugin}
            onClose={() => setShowDisableModal(false)}
            onConfirm={(msg) => {
              setShowDisableModal(false);
              onToggle(plugin, true, msg);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function PluginsPage() {
  const { user } = useAuth();
  const isAdmin = ['owner', 'admin', 'administrador'].includes(String(user?.rol || '').toLowerCase());

  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'disabled'>('all');

  const allTags = useMemo(() => getAllTags(plugins), [plugins]);

  const fetchPlugins = useCallback(async () => {
    try {
      const res = await api.get('/api/plugins');
      setPlugins(res.data?.plugins ?? []);
    } catch {
      notify.error('No se pudo cargar la lista de plugins');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlugins(); }, [fetchPlugins]);

  const handleToggle = useCallback(async (plugin: Plugin, disabled: boolean, message?: string) => {
    setToggling(plugin.name);
    try {
      await api.patch(`/api/plugins/${encodeURIComponent(plugin.name)}`, { disabled, message: message || null });
      setPlugins(prev => prev.map(p =>
        p.name === plugin.name
          ? { ...p, disabled, message: disabled ? (message || null) : null, disabledAt: disabled ? new Date().toISOString() : null }
          : p
      ));
      notify.success(disabled ? `Plugin "${plugin.label}" desactivado` : `Plugin "${plugin.label}" activado`);
    } catch {
      notify.error('No se pudo cambiar el estado del plugin');
    } finally {
      setToggling(null);
    }
  }, []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return plugins.filter(p => {
      if (filter === 'active' && p.disabled) return false;
      if (filter === 'disabled' && !p.disabled) return false;
      if (activeTag) {
        const normTags = p.tags.map(normalizeTag);
        if (!normTags.includes(activeTag)) return false;
      }
      if (!term) return true;
      return (
        p.label.toLowerCase().includes(term) ||
        p.name.toLowerCase().includes(term) ||
        p.help.some(h => h.toLowerCase().includes(term)) ||
        p.tags.some(t => t.toLowerCase().includes(term))
      );
    });
  }, [plugins, search, activeTag, filter]);

  const stats = useMemo(() => ({
    total: plugins.length,
    active: plugins.filter(p => !p.disabled).length,
    disabled: plugins.filter(p => p.disabled).length,
  }), [plugins]);

  const shouldReduceMotion = useReducedMotion();

  const pluginLanes = [
    {
      label: 'Total plugins',
      value: `${stats.total}`,
      description: stats.total > 0 ? `${stats.total} comandos registrados en el sistema.` : 'Sin plugins cargados.',
      icon: <Puzzle className="w-4 h-4" />,
      badge: 'total',
      badgeClassName: 'border-white/10 bg-white/[0.05] text-white/70',
      glowClassName: 'from-[rgb(var(--page-a))]/18 via-oguri-cyan/10 to-transparent',
    },
    {
      label: 'Activos',
      value: `${stats.active}`,
      description: stats.active > 0 ? 'Comandos operativos respondiendo a usuarios.' : 'Ningún plugin activo.',
      icon: <CheckCircle2 className="w-4 h-4" />,
      badge: 'on',
      badgeClassName: 'border-[rgb(var(--success))]/20 bg-[rgb(var(--success))]/10 text-[#c7f9d8]',
      glowClassName: 'from-[rgb(var(--success))]/18 via-oguri-cyan/10 to-transparent',
    },
    {
      label: 'Desactivados',
      value: `${stats.disabled}`,
      description: stats.disabled > 0 ? 'Comandos bloqueados temporalmente.' : 'Todos los plugins activos.',
      icon: <PowerOff className="w-4 h-4" />,
      badge: stats.disabled > 0 ? 'off' : 'clean',
      badgeClassName: stats.disabled > 0 ? 'border-danger/20 bg-danger/10 text-danger/80' : 'border-white/10 bg-white/[0.05] text-white/70',
      glowClassName: stats.disabled > 0 ? 'from-danger/14 via-red-900/10 to-transparent' : 'from-white/6 to-transparent',
    },
    {
      label: 'Filtro activo',
      value: activeTag ? (TAG_LABELS[activeTag] ?? activeTag) : filter === 'all' ? 'Todos' : filter === 'active' ? 'Activos' : 'Desactivados',
      description: activeTag ? `Mostrando plugins de categoría "${TAG_LABELS[activeTag] ?? activeTag}".` : 'Usa los filtros para encontrar plugins.',
      icon: <Filter className="w-4 h-4" />,
      badge: activeTag ? 'tag' : filter !== 'all' ? 'filter' : 'none',
      badgeClassName: activeTag || filter !== 'all' ? 'border-oguri-cyan/20 bg-oguri-cyan/10 text-oguri-cyan' : 'border-white/10 bg-white/[0.05] text-white/70',
      glowClassName: 'from-oguri-cyan/14 via-oguri-blue/10 to-transparent',
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
              animate={{ x: [0, 16, 0], y: [0, 12, 0], opacity: [0.18, 0.36, 0.18] }}
              transition={{ repeat: Infinity, duration: 10.5, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute right-[10%] top-[10%] h-56 w-56 rounded-full bg-danger/12 blur-3xl"
              animate={{ x: [0, -16, 0], y: [0, 16, 0], opacity: [0.12, 0.28, 0.12] }}
              transition={{ repeat: Infinity, duration: 12.5, ease: 'easeInOut', delay: 0.4 }}
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
              <Zap className="h-3.5 w-3.5 text-[rgb(var(--success))]/80" />
              Módulo de plugins
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Control de plugins</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-gray-300">
              Activa o desactiva comandos del bot en tiempo real. Los cambios se propagan instantáneamente.
            </p>
          </div>
          <div className="panel-hero-meta-grid">
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Total</p>
              <p className="mt-2 text-lg font-black text-white">{stats.total}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Activos</p>
              <p className="mt-2 text-lg font-black text-[#c7f9d8]">{stats.active}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Off</p>
              <p className="mt-2 text-lg font-black text-danger">{stats.disabled}</p>
            </div>
          </div>
        </div>
      </motion.div>

      <Reveal>
        <PageHeader
          title="Plugins"
          description="Activar o desactivar comandos del bot en tiempo real."
          icon={<Puzzle className="h-5 w-5" />}
        />
      </Reveal>

      {/* Lane cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {pluginLanes.map((lane, index) => (
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
                <p className="mt-1 text-base font-black text-white truncate">{lane.value}</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-400">{lane.description}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Stats bar */}
      <Reveal delay={0.05}>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'text-foreground' },
            { label: 'Activos', value: stats.active, color: 'text-[rgb(var(--success))]' },
            { label: 'Desactivados', value: stats.disabled, color: 'text-danger' },
          ].map(s => (
            <div
              key={s.label}
              className="rounded-[16px] border border-white/8 bg-white/[0.028] px-4 py-3 text-center"
            >
              <p className={cn('text-2xl font-black tabular-nums', s.color)}>{s.value}</p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </Reveal>

      {/* Search + filters */}
      <Reveal delay={0.08}>
        <div className="space-y-3">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o comando..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted focus:border-primary/30 focus:outline-none focus:ring-1 focus:ring-primary/15"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status filter */}
          <div className="flex gap-2">
            {(['all', 'active', 'disabled'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded-xl border px-3 py-1.5 text-xs font-bold transition-all',
                  filter === f
                    ? f === 'disabled'
                      ? 'border-danger/30 bg-danger/10 text-danger'
                      : 'border-primary/30 bg-primary/10 text-primary/90'
                    : 'border-white/8 bg-white/[0.03] text-muted hover:border-white/15 hover:text-foreground'
                )}
              >
                {f === 'all' ? 'Todos' : f === 'active' ? 'Activos' : 'Desactivados'}
              </button>
            ))}
          </div>

          {/* Tag filter pills */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveTag(null)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all',
                activeTag === null
                  ? 'border-primary/30 bg-primary/10 text-primary/90'
                  : 'border-white/8 bg-white/[0.03] text-muted hover:border-white/15 hover:text-foreground'
              )}
            >
              <Filter className="mr-1 inline-block h-2.5 w-2.5" />
              Todo
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag === activeTag ? null : tag)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all',
                  activeTag === tag
                    ? TAG_COLORS[tag] ?? 'border-primary/30 bg-primary/10 text-primary/90'
                    : 'border-white/8 bg-white/[0.03] text-muted hover:border-white/15 hover:text-foreground'
                )}
              >
                {TAG_LABELS[tag] ?? tag}
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          {filtered.length} de {plugins.length} plugins
          {activeTag && <span> · <span className="text-foreground font-semibold">{TAG_LABELS[activeTag] ?? activeTag}</span></span>}
        </p>
        <button
          onClick={fetchPlugins}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-semibold text-muted hover:border-white/15 hover:text-foreground transition-all disabled:opacity-50"
        >
          <RotateCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          Actualizar
        </button>
      </div>

      {/* Plugin grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-[18px] border border-white/6 bg-white/[0.025]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[22px] border border-white/8 bg-white/[0.02] py-16 text-center">
          <Puzzle className="mb-3 h-10 w-10 text-muted/40" />
          <p className="font-bold text-foreground">Sin resultados</p>
          <p className="mt-1 text-sm text-muted">Prueba con otro término o categoría</p>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map(plugin => (
              <PluginCard
                key={plugin.name}
                plugin={plugin}
                isAdmin={isAdmin}
                onToggle={handleToggle}
                toggling={toggling === plugin.name}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
