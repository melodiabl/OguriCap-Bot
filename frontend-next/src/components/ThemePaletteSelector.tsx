'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';

interface ColorPalette {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  description: string;
}

const AURA_PALETTES: ColorPalette[] = [
  {
    id: 'default',
    name: 'Aura Indigo',
    primary: '#6366f1',
    secondary: '#8b5cf6',
    accent: '#06b6d4',
    description: 'Paleta por defecto con tonos índigo y violeta'
  },
  {
    id: 'emerald',
    name: 'Aura Emerald',
    primary: '#10b981',
    secondary: '#06b6d4',
    accent: '#6366f1',
    description: 'Tonos esmeralda y cyan vibrantes'
  },
  {
    id: 'rose',
    name: 'Aura Rose',
    primary: '#f43f5e',
    secondary: '#ec4899',
    accent: '#f59e0b',
    description: 'Tonos rosa y ámbar cálidos'
  },
  {
    id: 'purple',
    name: 'Aura Purple',
    primary: '#a855f7',
    secondary: '#d946ef',
    accent: '#8b5cf6',
    description: 'Tonos púrpura y magenta intensos'
  },
  {
    id: 'blue',
    name: 'Aura Blue',
    primary: '#3b82f6',
    secondary: '#0ea5e9',
    accent: '#06b6d4',
    description: 'Tonos azul cielo y cyan frescos'
  },
  {
    id: 'amber',
    name: 'Aura Amber',
    primary: '#f59e0b',
    secondary: '#f97316',
    accent: '#eab308',
    description: 'Tonos ámbar y naranja energéticos'
  },
  {
    id: 'teal',
    name: 'Aura Teal',
    primary: '#14b8a6',
    secondary: '#06b6d4',
    accent: '#10b981',
    description: 'Tonos teal y turquesa refrescantes'
  },
  {
    id: 'violet',
    name: 'Aura Violet',
    primary: '#7c3aed',
    secondary: '#a855f7',
    accent: '#c026d3',
    description: 'Tonos violeta profundos y místicos'
  }
];

const STORAGE_KEY = 'oguricap:color-palette';

export function ThemePaletteSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPalette, setSelectedPalette] = useState<string>('default');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Cargar paleta guardada
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setSelectedPalette(saved);
        applyPalette(saved);
      }
    } catch (error) {
      console.error('Error loading palette:', error);
    }
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

  const applyPalette = (paletteId: string) => {
    const palette = AURA_PALETTES.find(p => p.id === paletteId);
    if (!palette) return;

    const root = document.documentElement;
    
    // Convertir hex a RGB
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
        : '99 102 241';
    };

    root.style.setProperty('--page-a', hexToRgb(palette.primary));
    root.style.setProperty('--page-b', hexToRgb(palette.secondary));
    root.style.setProperty('--page-c', hexToRgb(palette.accent));
    root.style.setProperty('--primary', hexToRgb(palette.primary));
    root.style.setProperty('--secondary', hexToRgb(palette.secondary));
    root.style.setProperty('--accent', hexToRgb(palette.accent));
  };

  const handleSelectPalette = (paletteId: string) => {
    setSelectedPalette(paletteId);
    applyPalette(paletteId);
    
    try {
      localStorage.setItem(STORAGE_KEY, paletteId);
    } catch (error) {
      console.error('Error saving palette:', error);
    }
    
    setIsOpen(false);
  };

  const currentPalette = AURA_PALETTES.find(p => p.id === selectedPalette) || AURA_PALETTES[0];

  return (
    <div className="relative">
      <Tooltip content="Paleta de colores" side="bottom">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Selector de paleta de colores"
          className="relative hover-glass-bright"
        >
          <Palette className="w-5 h-5" />
          <span 
            className="absolute bottom-1 right-1 w-2 h-2 rounded-full border border-background"
            style={{ backgroundColor: currentPalette.primary }}
          />
        </Button>
      </Tooltip>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown */}
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute left-1/2 -translate-x-1/2 md:left-auto md:right-0 md:translate-x-0 top-full mt-2 w-[calc(100vw-1rem)] max-w-sm z-50 rounded-2xl glass-dark border border-white/10 shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 border-b border-white/10 bg-gradient-to-r from-primary/10 to-secondary/10">
                <div className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-primary-400" />
                  <h3 className="font-semibold text-white">Paletas Aura</h3>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Personalizá los colores del panel
                </p>
              </div>

              {/* Palette Grid */}
              <div className="p-3 max-h-[400px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                <div className="grid grid-cols-1 gap-2">
                  {AURA_PALETTES.map((palette) => (
                    <motion.button
                      key={palette.id}
                      onClick={() => handleSelectPalette(palette.id)}
                      className={cn(
                        'relative p-3 rounded-xl border transition-all text-left',
                        'hover:bg-white/5 hover:border-white/20',
                        selectedPalette === palette.id
                          ? 'bg-white/10 border-white/30'
                          : 'bg-white/5 border-white/10'
                      )}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-start gap-3">
                        {/* Color Preview */}
                        <div className="flex gap-1 flex-shrink-0">
                          <div
                            className="w-6 h-6 rounded-lg border border-white/20 shadow-lg"
                            style={{ backgroundColor: palette.primary }}
                          />
                          <div
                            className="w-6 h-6 rounded-lg border border-white/20 shadow-lg"
                            style={{ backgroundColor: palette.secondary }}
                          />
                          <div
                            className="w-6 h-6 rounded-lg border border-white/20 shadow-lg"
                            style={{ backgroundColor: palette.accent }}
                          />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-semibold text-sm text-white">
                              {palette.name}
                            </h4>
                            {selectedPalette === palette.id && (
                              <Check className="w-4 h-4 text-primary-400 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {palette.description}
                          </p>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-white/10 bg-white/5">
                <p className="text-xs text-gray-500 text-center">
                  Los cambios se aplican inmediatamente
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
