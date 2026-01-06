'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '@/services/api';
import { useSocketConnection, SOCKET_EVENTS } from '@/contexts/SocketContext';

interface Group {
  id: number;
  wa_jid: string;
  nombre: string;
  descripcion: string;
  es_proveedor: boolean;
  bot_enabled?: boolean;
  created_at: string;
  updated_at: string;
}

interface GroupsContextType {
  groups: Group[];
  isLoading: boolean;
  error: string | null;
  refreshGroups: () => Promise<void>;
  lastUpdated: Date | null;
}

const GroupsContext = createContext<GroupsContextType | undefined>(undefined);

export function GroupsProvider({ children }: { children: React.ReactNode }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { socket, isConnected } = useSocketConnection();

  const refreshGroups = useCallback(async () => {
    try {
      setError(null);
      const response = await api.getGroups(1, 200); // Cargar más grupos de una vez
      setGroups(response?.grupos || response?.data || []);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Error al cargar grupos');
      console.error('Error loading groups:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Cargar grupos inicialmente
  useEffect(() => {
    refreshGroups();
  }, [refreshGroups]);

  // Escuchar eventos de Socket.IO para actualizar grupos automáticamente
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleBotConnected = () => {
      console.log('Bot conectado - actualizando grupos');
      refreshGroups();
    };

    const handleBotDisconnected = () => {
      console.log('Bot desconectado - actualizando grupos');
      refreshGroups();
    };

    const handleGroupUpdated = (data: any) => {
      console.log('Grupo actualizado:', data);
      refreshGroups();
    };

    const handleSubbotConnected = () => {
      console.log('SubBot conectado - actualizando grupos');
      refreshGroups();
    };

    // Registrar eventos
    socket.on(SOCKET_EVENTS.BOT_CONNECTED, handleBotConnected);
    socket.on(SOCKET_EVENTS.BOT_DISCONNECTED, handleBotDisconnected);
    socket.on(SOCKET_EVENTS.GRUPO_UPDATED, handleGroupUpdated);
    socket.on(SOCKET_EVENTS.SUBBOT_CONNECTED, handleSubbotConnected);
    socket.on(SOCKET_EVENTS.SUBBOT_DISCONNECTED, handleSubbotConnected);

    return () => {
      socket.off(SOCKET_EVENTS.BOT_CONNECTED, handleBotConnected);
      socket.off(SOCKET_EVENTS.BOT_DISCONNECTED, handleBotDisconnected);
      socket.off(SOCKET_EVENTS.GRUPO_UPDATED, handleGroupUpdated);
      socket.off(SOCKET_EVENTS.SUBBOT_CONNECTED, handleSubbotConnected);
      socket.off(SOCKET_EVENTS.SUBBOT_DISCONNECTED, handleSubbotConnected);
    };
  }, [socket, isConnected, refreshGroups]);

  // Fallback sin intervalos (solo si no hay conexión Socket.IO)
  useEffect(() => {
    if (isConnected) return; // No usar timer si hay Socket.IO

    const onFocus = () => refreshGroups();
    const onOnline = () => refreshGroups();

    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [isConnected, refreshGroups]);

  const value = {
    groups,
    isLoading,
    error,
    refreshGroups,
    lastUpdated,
  };

  return (
    <GroupsContext.Provider value={value}>
      {children}
    </GroupsContext.Provider>
  );
}

export function useGroups() {
  const context = useContext(GroupsContext);
  if (context === undefined) {
    throw new Error('useGroups must be used within a GroupsProvider');
  }
  return context;
}

// Hook para obtener grupos con cache inteligente
export function useGroupsCache() {
  const { groups, isLoading, error, refreshGroups, lastUpdated } = useGroups();
  
  // Solo refrescar si los datos tienen más de 2 minutos
  const shouldRefresh = useCallback(() => {
    if (!lastUpdated) return true;
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    return lastUpdated < twoMinutesAgo;
  }, [lastUpdated]);

  const getGroupsIfNeeded = useCallback(async () => {
    if (shouldRefresh() && !isLoading) {
      await refreshGroups();
    }
    return groups;
  }, [groups, shouldRefresh, isLoading, refreshGroups]);

  return {
    groups,
    isLoading,
    error,
    refreshGroups,
    getGroupsIfNeeded,
    lastUpdated,
  };
}
