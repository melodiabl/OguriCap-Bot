import React, { useEffect, useState } from 'react';
import {
  Bot,
  Users,
  MessageSquare,
  Upload,
  Activity,
  Clock,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  BarChart3,
  Smartphone,
  Zap,
  Heart,
  Eye,
  Send,
  Settings
} from 'lucide-react';

interface BotStatus {
  connected: boolean;
  phone?: string;
  uptime?: string;
  lastSeen?: string;
  qrCode?: string;
  pairingCode?: string;
  connectionStatus?: string;
}

interface DashboardStats {
  totalUsuarios: number;
  totalGrupos: number;
  totalAportes: number;
  totalMensajes: number;
  totalComandos: number;
  totalSubbots: number;
  mensajesHoy: number;
  comandosHoy: number;
  usuariosActivos: number;
  gruposActivos: number;
}

export const Home: React.FC = () => {
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    loadData();

    // Actualizar cada 30 segundos
    const interval = setInterval(() => {
      loadData();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar estado del bot y estadísticas en paralelo
      const [botResponse, statsResponse] = await Promise.all([
        fetch('/api/bot/status'),
        fetch('/api/dashboard/stats')
      ]);

      if (botResponse.ok) {
        const botData = await botResponse.json();
        setBotStatus(botData);
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      setLastUpdate(new Date());
    } catch (err) {
      setError('Error cargando datos del dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getConnectionStatus = () => {
    if (!botStatus) return { status: 'unknown', text: 'Desconocido', color: 'gray', icon: AlertCircle };

    if (botStatus.connected) {
      return { status: 'connected', text: 'Conectado', color: 'green', icon: CheckCircle };
    } else if (botStatus.connectionStatus === 'connecting') {
      return { status: 'connecting', text: 'Conectando...', color: 'yellow', icon: RefreshCw };
    } else {
      return { status: 'disconnected', text: 'Desconectado', color: 'red', icon: WifiOff };
    }
  };

  const formatUptime = (uptime?: string) => {
    if (!uptime) return '0h 0m';
    return uptime;
  };

  const formatLastSeen = (lastSeen?: string) => {
    if (!lastSeen) return 'Nunca';
    const date = new Date(lastSeen);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  const connectionStatus = getConnectionStatus();
  const StatusIcon = connectionStatus.icon;

  if (loading && !botStatus && !stats) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Cargando panel...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Bot className="w-8 h-8 text-blue-600" />
                Panel Principal
              </h1>
              <p className="text-gray-600 mt-2">
                Dashboard de control y monitoreo del bot de WhatsApp
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right text-sm text-gray-500">
                <div>Última actualización</div>
                <div className="font-medium">{lastUpdate.toLocaleTimeString()}</div>
              </div>
              <button
                onClick={loadData}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Estado del Bot */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Estado del Bot
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${
                connectionStatus.color === 'green' ? 'bg-green-100' :
                connectionStatus.color === 'yellow' ? 'bg-yellow-100' :
                connectionStatus.color === 'red' ? 'bg-red-100' : 'bg-gray-100'
              }`}>
                <StatusIcon className={`w-6 h-6 ${
                  connectionStatus.color === 'green' ? 'text-green-600' :
                  connectionStatus.color === 'yellow' ? 'text-yellow-600' :
                  connectionStatus.color === 'red' ? 'text-red-600' : 'text-gray-600'
                } ${connectionStatus.status === 'connecting' ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Estado</p>
                <p className={`text-lg font-semibold ${
                  connectionStatus.color === 'green' ? 'text-green-600' :
                  connectionStatus.color === 'yellow' ? 'text-yellow-600' :
                  connectionStatus.color === 'red' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {connectionStatus.text}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100">
                <Smartphone className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Teléfono</p>
                <p className="text-lg font-semibold text-gray-900">
                  {botStatus?.phone || 'No disponible'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-purple-100">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Tiempo activo</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatUptime(botStatus?.uptime)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-orange-100">
                <Eye className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Última actividad</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatLastSeen(botStatus?.lastSeen)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Estadísticas Generales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Usuarios</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalUsuarios || 0}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats?.usuariosActivos || 0} activos
                </p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Grupos</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalGrupos || 0}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats?.gruposActivos || 0} activos
                </p>
              </div>
              <MessageSquare className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Mensajes</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalMensajes || 0}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats?.mensajesHoy || 0} hoy
                </p>
              </div>
              <Send className="w-8 h-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Comandos</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalComandos || 0}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats?.comandosHoy || 0} usados hoy
                </p>
              </div>
              <Zap className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
        </div>

        {/* Estadísticas Adicionales */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Subbots</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalSubbots || 0}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Botes adicionales
                </p>
              </div>
              <Bot className="w-8 h-8 text-indigo-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Aportes</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalAportes || 0}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Contribuciones
                </p>
              </div>
              <Heart className="w-8 h-8 text-red-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Multimedia</p>
                <p className="text-2xl font-bold text-gray-900">0</p>
                <p className="text-xs text-gray-500 mt-1">
                  Archivos gestionados
                </p>
              </div>
              <Upload className="w-8 h-8 text-pink-500" />
            </div>
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Acciones Rápidas
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button className="flex items-center gap-3 p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
              <Bot className="w-5 h-5 text-blue-600" />
              <div className="text-left">
                <p className="font-medium text-blue-900">Gestionar Subbots</p>
                <p className="text-sm text-blue-600">Crear y administrar subbots</p>
              </div>
            </button>

            <button className="flex items-center gap-3 p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
              <Zap className="w-5 h-5 text-green-600" />
              <div className="text-left">
                <p className="font-medium text-green-900">Comandos</p>
                <p className="text-sm text-green-600">Configurar comandos del bot</p>
              </div>
            </button>

            <button className="flex items-center gap-3 p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors">
              <Users className="w-5 h-5 text-purple-600" />
              <div className="text-left">
                <p className="font-medium text-purple-900">Usuarios</p>
                <p className="text-sm text-purple-600">Gestionar usuarios</p>
              </div>
            </button>

            <button className="flex items-center gap-3 p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors">
              <BarChart3 className="w-5 h-5 text-orange-600" />
              <div className="text-left">
                <p className="font-medium text-orange-900">Analíticas</p>
                <p className="text-sm text-orange-600">Ver estadísticas detalladas</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
