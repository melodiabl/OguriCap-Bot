'use client';

import React, { useMemo } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from './ui/Button';

export const ThemeToggle: React.FC = () => {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const current = useMemo(() => {
    const t = (resolvedTheme || theme || 'dark').toString();
    return t === 'light' ? 'light' : 'dark';
  }, [resolvedTheme, theme]);

  const toggleTheme = () => {
    setTheme(current === 'dark' ? 'light' : 'dark');
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={toggleTheme}
      icon={current === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      title={`Cambiar a tema ${current === 'dark' ? 'claro' : 'oscuro'}`}
    >
      {current === 'dark' ? 'Claro' : 'Oscuro'}
    </Button>
  );
};

