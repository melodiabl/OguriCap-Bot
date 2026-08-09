'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type AuraType = 'purple' | 'phantom' | 'gold' | 'cyan';

interface OguriThemeContextType {
  isInZone: boolean;
  setIsInZone: (val: boolean) => void;
  currentAura: AuraType;
  setCurrentAura: (aura: AuraType) => void;
  toggleZone: () => void;
}

const OguriThemeContext = createContext<OguriThemeContextType | undefined>(undefined);

export function OguriThemeProvider({ children }: { children: React.ReactNode }) {
  const [isInZone, setIsInZone] = useState(false);
  const [currentAura, setCurrentAura] = useState<AuraType>('purple');

  // Persistir aura en localStorage
  useEffect(() => {
    const savedAura = localStorage.getItem('oguri-aura') as AuraType;
    if (savedAura) setCurrentAura(savedAura);
  }, []);

  useEffect(() => {
    localStorage.setItem('oguri-aura', currentAura);
    // Aplicar clase al body para estilos globales
    document.body.className = document.body.className.replace(/aura-\w+/g, '').trim();
    document.body.classList.add(`aura-${currentAura}`);
    
    if (isInZone) {
      document.body.classList.add('is-in-zone');
    } else {
      document.body.classList.remove('is-in-zone');
    }
  }, [currentAura, isInZone]);

  const toggleZone = () => setIsInZone(prev => !prev);

  return (
    <OguriThemeContext.Provider value={{ isInZone, setIsInZone, currentAura, setCurrentAura, toggleZone }}>
      {children}
    </OguriThemeContext.Provider>
  );
}

export function useOguriTheme() {
  const context = useContext(OguriThemeContext);
  if (context === undefined) {
    throw new Error('useOguriTheme must be used within an OguriThemeProvider');
  }
  return context;
}
