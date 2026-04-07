'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Check, Gauge, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { useDevicePerformance, type VisualIntensity } from '@/contexts/DevicePerformanceContext';
import { cn } from '@/lib/utils';

const OPTIONS: Array<{
  id: VisualIntensity;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  dot: string;
}> = [
  {
    id: 'normal',
    name: 'Normal',
    description: 'Brillo contenido y menos capas ambientales.',
    icon: Gauge,
    dot: 'bg-slate-300',
  },
  {
    id: 'vivid',
    name: 'Vivo',
    description: 'Balance entre color, glow y movimiento.',
    icon: Sparkles,
    dot: 'bg-oguri-cyan',
  },
  {
    id: 'ultra',
    name: 'Ultra',
    description: 'Modo anime/neon con toda la intensidad visual.',
    icon: Zap,
    dot: 'bg-oguri-gold',
  },
];

export function VisualIntensitySelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { visualIntensity, setVisualIntensity } = useDevicePerformance();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen]);

  const current = OPTIONS.find((option) => option.id === visualIntensity) ?? OPTIONS[1];
  const CurrentIcon = current.icon;

  return (
    <div className="relative">
      <Tooltip content={`Intensidad visual: ${current.name}`} side="bottom">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label="Selector de intensidad visual"
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
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="fixed left-1/2 top-1/2 z-[120] flex w-[min(20rem,calc(100vw-1rem))] max-h-[calc(100vh-1rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border/15 bg-card/92 shadow-2xl backdrop-blur-2xl"
                >
                  <div className="border-b border-border/15 bg-gradient-to-r from-primary/10 to-secondary/10 p-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary-400" />
                      <h3 className="font-semibold text-foreground">Intensidad Visual</h3>
                    </div>
                    <p className="mt-1 text-xs text-[rgb(var(--text-secondary))]">Cambia entre una atmósfera más sobria o más intensa.</p>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3" style={{ scrollbarWidth: 'thin' }}>
                    <div className="grid gap-2">
                      {OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const isActive = option.id === visualIntensity;

                        return (
                          <motion.button
                            key={option.id}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.985 }}
                            onClick={() => {
                              setVisualIntensity(option.id);
                              setIsOpen(false);
                            }}
                            className={cn(
                              'flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all duration-200',
                              isActive
                                ? 'border-primary/25 bg-gradient-to-r from-primary/14 via-secondary/10 to-accent/10 text-foreground shadow-glow-oguri-purple'
                                : 'border-border/10 bg-white/[0.03] text-[rgb(var(--text-secondary))] hover:border-border/20 hover:bg-white/[0.06] hover:text-foreground'
                            )}
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/10 text-primary">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-foreground">{option.name}</span>
                                <span className={cn('h-2 w-2 rounded-full', option.dot)} />
                              </div>
                              <p className="mt-1 text-xs text-[rgb(var(--text-secondary))]">{option.description}</p>
                            </div>
                            {isActive && <Check className="h-4 w-4 shrink-0 text-primary" />}
                          </motion.button>
                        );
                      })}
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
