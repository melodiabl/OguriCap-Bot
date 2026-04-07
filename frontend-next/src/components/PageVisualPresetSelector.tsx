'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Check, Copy, Layers3, ScanLine, Sparkles, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { NAV_ITEMS } from '@/lib/navigation';
import { getPageKeyFromPathname } from '@/lib/pageTheme';
import {
  DEFAULT_PAGE_VISUAL_PRESET,
  getPageVisualPresetStorageKey,
  isPageVisualPreset,
  type PageVisualPreset,
} from '@/lib/pageVisualPreset';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';

const OPTIONS: Array<{
  id: PageVisualPreset;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  dot: string;
}> = [
  {
    id: 'default',
    name: 'Firma',
    description: 'Mantiene el look base de la página actual.',
    icon: Layers3,
    dot: 'bg-oguri-lavender',
  },
  {
    id: 'nova',
    name: 'Nova',
    description: 'Más aura, color y profundidad ambiental.',
    icon: Sparkles,
    dot: 'bg-oguri-gold',
  },
  {
    id: 'hologram',
    name: 'Holograma',
    description: 'Más brillo técnico, sheens y lectura futurista.',
    icon: ScanLine,
    dot: 'bg-oguri-cyan',
  },
  {
    id: 'terminal',
    name: 'Terminal',
    description: 'HUD más táctico, escaneo y textura de consola.',
    icon: Terminal,
    dot: 'bg-emerald-400',
  },
];

function PresetPreview({ preset }: { preset: PageVisualPreset }) {
  const isTerminal = preset === 'terminal';
  const isHologram = preset === 'hologram';
  const isNova = preset === 'nova';

  return (
    <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#050816]/85 shadow-[0_12px_30px_-18px_rgba(0,0,0,0.45)]">
      <div
        className={cn(
          'absolute inset-0 opacity-90',
          isTerminal
            ? 'bg-[radial-gradient(circle_at_18%_20%,rgba(16,185,129,0.22),transparent_26%),radial-gradient(circle_at_82%_24%,rgba(59,130,246,0.16),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(3,7,18,0.92))]'
            : 'bg-[radial-gradient(circle_at_18%_20%,rgba(var(--page-a),0.22),transparent_26%),radial-gradient(circle_at_82%_24%,rgba(var(--page-b),0.18),transparent_28%),radial-gradient(circle_at_50%_82%,rgba(var(--page-c),0.16),transparent_34%),linear-gradient(180deg,rgba(5,8,22,0.94),rgba(8,14,32,0.92))]'
        )}
      />
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:10px_10px]" />
      <div
        className={cn(
          'absolute left-2 top-2 h-6 w-6 rounded-full blur-xl',
          isTerminal ? 'bg-emerald-400/30' : 'bg-primary/28'
        )}
      />
      <div
        className={cn(
          'absolute bottom-2 right-2 h-7 w-7 rounded-full blur-xl',
          isTerminal ? 'bg-blue-400/25' : 'bg-secondary/25'
        )}
      />
      {isNova && <div className="absolute inset-0 bg-[conic-gradient(from_120deg_at_50%_50%,rgba(245,158,11,0.12),transparent,rgba(var(--page-b),0.12),transparent,rgba(var(--page-c),0.10))] mix-blend-screen" />}
      {isHologram && <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.18)_38%,transparent_56%),repeating-linear-gradient(180deg,rgba(255,255,255,0.06)_0_1px,transparent_1px_4px)] opacity-65" />}
      {isTerminal && <div className="absolute inset-0 bg-[repeating-linear-gradient(180deg,rgba(16,185,129,0.10)_0_1px,transparent_1px_4px)] opacity-80" />}
      {!isTerminal && !isHologram && <div className="absolute inset-x-2 bottom-2 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />}
    </div>
  );
}

export function PageVisualPresetSelector() {
  const pathname = usePathname();
  const pageKey = getPageKeyFromPathname(pathname);
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<PageVisualPreset>(DEFAULT_PAGE_VISUAL_PRESET);
  const [presetByPage, setPresetByPage] = useState<Record<string, PageVisualPreset>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const pageOptions = useMemo(
    () =>
      NAV_ITEMS.map((item) => ({
        pageKey: item.pageKey,
        label: item.headerLabel || item.label,
        icon: item.icon,
      })),
    []
  );

  const readStoredPreset = useCallback((targetPageKey: string): PageVisualPreset => {
    try {
      const raw = window.localStorage.getItem(getPageVisualPresetStorageKey(targetPageKey as any));
      return raw && isPageVisualPreset(raw) ? raw : DEFAULT_PAGE_VISUAL_PRESET;
    } catch {
      return DEFAULT_PAGE_VISUAL_PRESET;
    }
  }, []);

  const syncPresetSnapshot = useCallback(() => {
    const next: Record<string, PageVisualPreset> = {};
    pageOptions.forEach((item) => {
      next[item.pageKey] = readStoredPreset(item.pageKey);
    });
    setPresetByPage(next);
  }, [pageOptions, readStoredPreset]);

  useEffect(() => {
    const apply = (preset: PageVisualPreset) => {
      document.documentElement.dataset.pagePreset = preset;
      document.body.dataset.pagePreset = preset;
    };

    const preset = readStoredPreset(pageKey);
    setSelectedPreset(preset);
    apply(preset);
    syncPresetSnapshot();
  }, [pageKey, readStoredPreset, syncPresetSnapshot]);

  useEffect(() => {
    if (!isOpen) return;

    syncPresetSnapshot();

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, syncPresetSnapshot]);

  const handleSelectPreset = (preset: PageVisualPreset) => {
    setSelectedPreset(preset);
    document.documentElement.dataset.pagePreset = preset;
    document.body.dataset.pagePreset = preset;

    try {
      window.localStorage.setItem(getPageVisualPresetStorageKey(pageKey), preset);
    } catch {
      // ignore
    }

    setPresetByPage((prev) => ({ ...prev, [pageKey]: preset }));
  };

  const handleCopyPreset = (targetPageKeys: string[]) => {
    try {
      targetPageKeys.forEach((targetPageKey) => {
        window.localStorage.setItem(getPageVisualPresetStorageKey(targetPageKey as any), selectedPreset);
      });
    } catch {
      // ignore
    }

    setPresetByPage((prev) => {
      const next = { ...prev };
      targetPageKeys.forEach((targetPageKey) => {
        next[targetPageKey] = selectedPreset;
      });
      return next;
    });

    notify.success(
      targetPageKeys.length === 1
        ? 'Preset copiado a la página seleccionada'
        : `Preset copiado a ${targetPageKeys.length} páginas`,
      { dedupeKey: 'page-preset-copy', dedupeMs: 1200 }
    );
  };

  const current = OPTIONS.find((option) => option.id === selectedPreset) ?? OPTIONS[0];
  const CurrentIcon = current.icon;
  const copyTargets = pageOptions.filter((item) => item.pageKey !== pageKey);
  const currentPageLabel = pageOptions.find((item) => item.pageKey === pageKey)?.label || 'esta página';

  return (
    <div className="relative">
      <Tooltip content={`Preset visual de esta página: ${current.name}`} side="bottom">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label="Selector de preset visual por página"
          className="relative rounded-2xl border border-transparent bg-transparent text-muted hover:border-border/20 hover:bg-white/[0.06] hover:text-foreground"
        >
          <CurrentIcon className="h-5 w-5" />
          <span className={cn('absolute bottom-1 right-1 h-2 w-2 rounded-full border border-background', current.dot)} />
        </Button>
      </Tooltip>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[110]"
                  onClick={() => setIsOpen(false)}
                />

                <motion.div
                  ref={dropdownRef}
                  initial={{ opacity: 0, y: 10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                  className="fixed left-1/2 top-1/2 z-[120] flex w-[min(26rem,calc(100vw-1rem))] max-h-[calc(100vh-1rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border/15 bg-card/92 shadow-2xl backdrop-blur-2xl"
                >
                  <div className="border-b border-border/15 bg-gradient-to-r from-primary/10 to-secondary/10 p-4">
                    <div className="flex items-center gap-2">
                      <Layers3 className="h-5 w-5 text-primary-400" />
                      <h3 className="font-semibold text-foreground">Preset por Página</h3>
                    </div>
                    <p className="mt-1 text-xs text-[rgb(var(--text-secondary))]">
                      Ajusta el mood visual solo para {currentPageLabel} y, si quieres, cópialo a otras secciones.
                    </p>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3" style={{ scrollbarWidth: 'thin' }}>
                    <div className="grid gap-2">
                      {OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const isActive = option.id === selectedPreset;

                        return (
                          <motion.button
                            key={option.id}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.985 }}
                            onClick={() => handleSelectPreset(option.id)}
                            className={cn(
                              'grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all duration-200',
                              isActive
                                ? 'border-primary/25 bg-gradient-to-r from-primary/14 via-secondary/10 to-accent/10 text-foreground shadow-glow-oguri-purple'
                                : 'border-border/10 bg-white/[0.03] text-[rgb(var(--text-secondary))] hover:border-border/20 hover:bg-white/[0.06] hover:text-foreground'
                            )}
                          >
                            <PresetPreview preset={option.id} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/10 text-primary">
                                  <Icon className="h-4 w-4" />
                                </div>
                                <span className="text-sm font-black text-foreground">{option.name}</span>
                                <span className={cn('h-2 w-2 rounded-full', option.dot)} />
                              </div>
                              <p className="mt-2 text-xs text-[rgb(var(--text-secondary))]">{option.description}</p>
                            </div>
                            {isActive && <Check className="h-4 w-4 shrink-0 text-primary" />}
                          </motion.button>
                        );
                      })}
                    </div>

                    <div className="mt-4 rounded-2xl border border-border/15 bg-white/[0.03] p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-foreground">Copiar preset actual</p>
                          <p className="text-xs text-[rgb(var(--text-secondary))]">Replica `{current.name}` en otras páginas sin tocar la paleta global.</p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Copy className="h-3.5 w-3.5" />}
                          onClick={() => handleCopyPreset(copyTargets.map((item) => item.pageKey))}
                        >
                          A Todas
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {copyTargets.map((item) => {
                          const Icon = item.icon;
                          const alreadyApplied = presetByPage[item.pageKey] === selectedPreset;

                          return (
                            <motion.button
                              key={item.pageKey}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.985 }}
                              onClick={() => handleCopyPreset([item.pageKey])}
                              className={cn(
                                'flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all duration-200',
                                alreadyApplied
                                  ? 'border-primary/22 bg-primary/10 text-foreground'
                                  : 'border-border/10 bg-black/10 text-[rgb(var(--text-secondary))] hover:border-border/20 hover:bg-white/[0.05] hover:text-foreground'
                              )}
                            >
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/10 text-primary">
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-foreground">{item.label}</p>
                                <p className="text-xs text-[rgb(var(--text-secondary))]">
                                  {alreadyApplied ? 'Ya usa este preset' : 'Aplicar aquí'}
                                </p>
                              </div>
                              {alreadyApplied && <Check className="h-4 w-4 shrink-0 text-primary" />}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
