'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSocketConnection } from './SocketContext';
import api from '@/services/api';

interface BotGlobalStateContextType {
  isGloballyOn: boolean;
  setGlobalState: (isOn: boolean) => Promise<void>;
  refreshGlobalState: () => Promise<void>;
  isLoading: boolean;
}

const BotGlobalStateContext = createContext<BotGlobalStateContextType | undefined>(undefined);

export const BotGlobalStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isGloballyOn, setIsGloballyOn] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { socket, isConnected } = useSocketConnection();

  // Función para obtener el estado actual del servidor
  const refreshGlobalState = async () => {
    try {
      const response = await api.getBotGlobalState();
      setIsGloballyOn(response?.isOn !== false);
    } catch (error) {
      console.error('Error fetching global bot state:', error);
      setIsGloballyOn(false);
    }
  };

  // Función para cambiar el estado global
  const setGlobalState = async (isOn: boolean) => {
    setIsLoading(true);
    try {
      await api.setBotGlobalState(isOn);
      
      // Actualizar estado local inmediatamente
      setIsGloballyOn(isOn);
      
      // Emitir evento via socket para sincronizar otras pestañas/usuarios
      if (socket) {
        socket.emit('bot:globalStateChanged', { isOn });
      }
      
      // Forzar actualización en todas las páginas
      window.dispatchEvent(new CustomEvent('botGlobalStateChanged', { 
        detail: { isOn } 
      }));
      
    } catch (error) {
      console.error('Error setting global bot state:', error);
      // Revertir estado local si hay error
      await refreshGlobalState();
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar estado inicial
  useEffect(() => {
    refreshGlobalState();
  }, []);

  // Escuchar cambios via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleGlobalStateChange = (data: { isOn: boolean }) => {
      setIsGloballyOn(data.isOn);
    };

    // Escuchar eventos de cambio de estado global
    socket.on('bot:globalStateChanged', handleGlobalStateChange);
    socket.on('bot:globalShutdown', () => setIsGloballyOn(false));
    socket.on('bot:globalStartup', () => setIsGloballyOn(true));

    return () => {
      socket.off('bot:globalStateChanged', handleGlobalStateChange);
      socket.off('bot:globalShutdown');
      socket.off('bot:globalStartup');
    };
  }, [socket]);

  // Refrescar estado cuando se reconecta el socket
  useEffect(() => {
    if (isConnected) {
      refreshGlobalState();
    }
  }, [isConnected]);

  // Escuchar eventos personalizados del navegador para sincronización
  useEffect(() => {
    const handleCustomGlobalStateChange = (event: CustomEvent) => {
      setIsGloballyOn(event.detail.isOn);
    };

    window.addEventListener('botGlobalStateChanged', handleCustomGlobalStateChange as EventListener);
    
    return () => {
      window.removeEventListener('botGlobalStateChanged', handleCustomGlobalStateChange as EventListener);
    };
  }, []);

  return (
    <BotGlobalStateContext.Provider
      value={{
        isGloballyOn,
        setGlobalState,
        refreshGlobalState,
        isLoading,
      }}
    >
      {children}
    </BotGlobalStateContext.Provider>
  );
};

export const useBotGlobalState = () => {
  const context = useContext(BotGlobalStateContext);
  if (!context) {
    throw new Error('useBotGlobalState must be used within a BotGlobalStateProvider');
  }
  return context;
};
