'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Search, Filter, MessageSquare, Calendar, Activity,
  Crown, Shield, User, Ban, CheckCircle, Clock, TrendingUp
} from 'lucide-react';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AutoRefreshIndicator } from '@/components/ui/AutoRefreshIndicator';
import api from '@/services/api';
import toast from 'react-hot-toast';

interface CommunityUser {
  jid: string;
  name?: string;
  pushName?: string;
  lastSeen?: string;
  messageCount: number;
  commandCount: number;
  joinDate?: string;
  isActive: boolean;
  isBanned: boolean;
  role: 'member' | 'admin' | 'owner';
  groups: string[];
}

interface CommunityStats {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  newUsersToday: number;
  messagesTotal: number;
  commandsTotal: number;
  topUsers: CommunityUser[];
}

export default function CommunityUsersPage() {
  const [users, setUsers] = useState<CommunityUser[]>([]);
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 120000); // Auto-refresh cada 2 minutos
    return () => clearInterval(interval);
  }, [page, statusFilter, roleFilter]);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (page === 1) {
        loadUsers();
      } else {
        setPage(1);
      }
    }, 500);
    return () => clearTimeout(delayedSearch);
  }, [searchTerm]);

  const loadData = async () => {
    await Promise.all([loadUsers(), loadStats()]);
  };

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const response = await api.getCommunityUsers(page, 20, searchTerm, statusFilter, roleFilter);
      setUsers(response.data || []);
      setPagination(response.pagination);
    } catch (error) {
      toast.error('Error al cargar usuarios de la comunidad');
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.getCommunityStats();
      setStats(response);
    } catch (error) {
      console.error('Error loading community stats');
    }
  };

  const handleBanUser = async (jid: string, banned: boolean) => {
    try {
      await api.banCommunityUser(jid, banned);
      toast.success(banned ? 'Usuario baneado' : 'Usuario desbaneado');
      loadUsers();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Error al cambiar estado del usuario');
    }
  };

  const handlePromoteUser = async (jid: string, role: string) => {
    try {
      await api.promoteCommunityUser(jid, role);
      toast.success(`Usuario ${role === 'admin' ? 'promovido a admin' : 'degradado a miembro'}`);
      loadUsers();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Error al cambiar rol del usuario');
    }
  };

  const formatLastSeen = (lastSeen?: string) => {
    if (!lastSeen) return 'Nunca';
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
    return `Hace ${Math.floor(diffDays / 30)} meses`;
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="w-4 h-4 text-yellow-400" />;
      case 'admin': return <Shield className="w-4 h-4 text-blue-400" />;
      default: return <User className="w-4 h-4 text-gray-400" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'admin': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      (user.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.pushName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      user.jid.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && user.isActive) ||
      (statusFilter === 'banned' && user.isBanned) ||
      (statusFilter === 'inactive' && !user.isActive && !user.isBanned);
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesStatus && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-3xl font-bold text-white">Usuarios de la Comunidad</h1>
          <p className="text-gray-400 mt-1">Gestiona los miembros de tu comunidad de WhatsApp</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
          <AutoRefreshIndicator isActive={true} interval={60000} />
        </motion.div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          title="Total Usuarios" 
          value={stats?.totalUsers || 0} 
          subtitle={`${stats?.newUsersToday || 0} nuevos hoy`}
          icon={<Users className="w-6 h-6" />} 
          color="primary" 
          delay={0} 
          loading={!stats} 
        />
        <StatCard 
          title="Usuarios Activos" 
          value={stats?.activeUsers || 0} 
          subtitle="Últimos 7 días"
          icon={<Activity className="w-6 h-6" />} 
          color="success" 
          delay={0.1} 
          loading={!stats} 
        />
        <StatCard 
          title="Mensajes Totales" 
          value={stats?.messagesTotal || 0} 
          subtitle={`${stats?.commandsTotal || 0} comandos`}
          icon={<MessageSquare className="w-6 h-6" />} 
          color="info" 
          delay={0.2} 
          loading={!stats} 
        />
        <StatCard 
          title="Usuarios Baneados" 
          value={stats?.bannedUsers || 0} 
          subtitle="Moderación activa"
          icon={<Ban className="w-6 h-6" />} 
          color="danger" 
          delay={0.3} 
          loading={!stats} 
        />
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por nombre o número..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-glass pl-10 w-full"
              />
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-glass min-w-[120px]"
              >
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
                <option value="banned">Baneados</option>
              </select>
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="input-glass min-w-[120px]"
            >
              <option value="all">Todos los roles</option>
              <option value="owner">Propietarios</option>
              <option value="admin">Administradores</option>
              <option value="member">Miembros</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Users List */}
      <Card className="overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">
            Lista de Usuarios ({filteredUsers.length})
          </h3>
        </div>
        
        {isLoading ? (
          <div className="p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
                <div className="w-12 h-12 bg-white/10 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-white/10 rounded mb-2 w-1/3"></div>
                  <div className="h-3 bg-white/5 rounded w-1/2"></div>
                </div>
                <div className="flex gap-2">
                  <div className="h-8 bg-white/10 rounded w-16"></div>
                  <div className="h-8 bg-white/10 rounded w-16"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No hay usuarios</h3>
            <p className="text-gray-400">
              {searchTerm || statusFilter !== 'all' || roleFilter !== 'all'
                ? 'No se encontraron usuarios con los filtros aplicados'
                : 'No hay usuarios registrados en la comunidad'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {filteredUsers.map((user, index) => (
              <motion.div
                key={user.jid}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-6 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        user.isBanned ? 'bg-red-500/20' : user.isActive ? 'bg-emerald-500/20' : 'bg-gray-500/20'
                      }`}>
                        <User className={`w-6 h-6 ${
                          user.isBanned ? 'text-red-400' : user.isActive ? 'text-emerald-400' : 'text-gray-400'
                        }`} />
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-900 ${
                        user.isBanned ? 'bg-red-500' : user.isActive ? 'bg-emerald-500' : 'bg-gray-500'
                      }`}></div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-white">
                          {user.name || user.pushName || 'Usuario sin nombre'}
                        </h4>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getRoleColor(user.role)}`}>
                          <div className="flex items-center gap-1">
                            {getRoleIcon(user.role)}
                            <span className="capitalize">{user.role}</span>
                          </div>
                        </div>
                        {user.isBanned && (
                          <div className="px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                            Baneado
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span className="font-mono">{user.jid.split('@')[0]}</span>
                        <div className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          <span>{user.messageCount} mensajes</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          <span>{user.commandCount} comandos</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Visto {formatLastSeen(user.lastSeen)}</span>
                        </div>
                      </div>
                      
                      {user.groups.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {user.groups.slice(0, 3).map((group, i) => (
                            <span key={i} className="px-2 py-1 bg-white/10 rounded text-xs text-gray-300">
                              {group}
                            </span>
                          ))}
                          {user.groups.length > 3 && (
                            <span className="px-2 py-1 bg-white/10 rounded text-xs text-gray-400">
                              +{user.groups.length - 3} más
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {!user.isBanned ? (
                      <>
                        {user.role === 'member' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<Shield className="w-3 h-3" />}
                            onClick={() => handlePromoteUser(user.jid, 'admin')}
                          >
                            Promover
                          </Button>
                        )}
                        {user.role === 'admin' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<User className="w-3 h-3" />}
                            onClick={() => handlePromoteUser(user.jid, 'member')}
                          >
                            Degradar
                          </Button>
                        )}
                        <Button
                          variant="danger"
                          size="sm"
                          icon={<Ban className="w-3 h-3" />}
                          onClick={() => handleBanUser(user.jid, true)}
                        >
                          Banear
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="success"
                        size="sm"
                        icon={<CheckCircle className="w-3 h-3" />}
                        onClick={() => handleBanUser(user.jid, false)}
                      >
                        Desbanear
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
        
        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="p-6 border-t border-white/10 flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Mostrando {((pagination.page - 1) * pagination.limit) + 1} a {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} usuarios
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Top Users */}
      {stats?.topUsers && stats.topUsers.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Usuarios Más Activos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.topUsers.slice(0, 3).map((user, index) => (
              <div key={user.jid} className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                    index === 1 ? 'bg-gray-400/20 text-gray-300' :
                    'bg-amber-600/20 text-amber-400'
                  }`}>
                    #{index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-white">{user.name || user.pushName || 'Usuario'}</p>
                    <p className="text-xs text-gray-400">{user.jid.split('@')[0]}</p>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Mensajes:</span>
                  <span className="text-white font-medium">{user.messageCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Comandos:</span>
                  <span className="text-white font-medium">{user.commandCount}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}