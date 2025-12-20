import axios, { AxiosInstance } from 'axios';
import { User, BotStatus, Aporte, Pedido, Proveedor, Group, DashboardStats } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      headers: { 'Content-Type': 'application/json' },
    });

    this.api.interceptors.request.use((config) => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 && typeof window !== 'undefined') {
          localStorage.removeItem('token');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth
  async login(username: string, password: string) {
    const response = await this.api.post('/api/auth/login', { username, password });
    return response.data;
  }

  async getMe() {
    const response = await this.api.get('/api/auth/me');
    return response.data;
  }

  async verifyToken() {
    const response = await this.api.get('/api/auth/verify');
    return response.data;
  }

  async resetUserPassword(username: string, whatsapp_number: string) {
    const response = await this.api.post('/api/auth/reset-password', { username, whatsapp_number });
    return response.data;
  }

  // Bot
  async getBotStatus(): Promise<BotStatus> {
    const response = await this.api.get('/api/bot/status');
    return response.data;
  }

  async getBotQR() {
    const response = await this.api.get('/api/bot/qr');
    return response.data;
  }

  async restartBot() {
    const response = await this.api.post('/api/bot/restart');
    return response.data;
  }

  async disconnectBot() {
    const response = await this.api.post('/api/bot/disconnect');
    return response.data;
  }

  async getMainBotStatus(): Promise<BotStatus> {
    const response = await this.api.get('/api/bot/main/status');
    return response.data;
  }

  async getMainBotQR() {
    const response = await this.api.get('/api/bot/main/qr');
    return response.data;
  }

  async getMainBotPairingCode() {
    const response = await this.api.get('/api/bot/main/pairing-code');
    return response.data;
  }

  async setMainBotMethod(method: 'qr' | 'pairing', phoneNumber?: string) {
    const response = await this.api.post('/api/bot/main/method', { method, phoneNumber });
    return response.data;
  }

  async disconnectMainBot() {
    const response = await this.api.post('/api/bot/main/disconnect');
    return response.data;
  }

  async restartMainBot(method?: 'qr' | 'pairing', phoneNumber?: string) {
    const response = await this.api.post('/api/bot/main/restart', { method, phoneNumber });
    return response.data;
  }

  // Subbots
  async getSubbots() {
    const response = await this.api.get('/api/subbot/list');
    return response.data;
  }

  async getSubbotStatus() {
    const response = await this.api.get('/api/subbot/status');
    return response.data;
  }

  async createSubbot(userId: number, type: 'qr' | 'code', phoneNumber?: string) {
    const response = await this.api.post('/api/subbot/create', { userId, type, phoneNumber });
    return response.data;
  }

  async deleteSubbot(subbotId: string) {
    const response = await this.api.delete(`/api/subbot/${subbotId}`);
    return response.data;
  }

  async getSubbotQR(subbotId: string) {
    const response = await this.api.get(`/api/subbot/qr/${encodeURIComponent(subbotId)}`);
    return response.data;
  }

  // Dashboard
  async getStats(): Promise<DashboardStats> {
    const [overview, pedidos] = await Promise.all([
      this.api.get('/api/dashboard/stats').then(r => r.data).catch(() => ({})),
      this.api.get('/api/pedidos/stats').then(r => r.data).catch(() => ({}))
    ]);
    return {
      totalUsuarios: overview.usuarios || 0,
      totalGrupos: overview.grupos || 0,
      totalAportes: overview.aportes || 0,
      totalPedidos: overview.pedidos || 0,
      totalSubbots: overview.subbots || 0,
      usuariosActivos: overview.usuariosActivos || 0,
      gruposActivos: overview.gruposActivos || 0,
      aportesHoy: overview.aportesHoy || 0,
      pedidosHoy: pedidos.pedidosPendientes || 0,
      mensajesHoy: overview.mensajesHoy || 0,
      comandosHoy: overview.comandosHoy || 0,
      totalMensajes: overview.totalMensajes || 0,
      totalComandos: overview.totalComandos || 0,
    };
  }

  // Groups
  async getGroups(page = 1, limit = 20, search?: string, botEnabledFilter?: string, proveedorFilter?: string) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (search) params.append('search', search);
    if (botEnabledFilter) params.append('botEnabled', botEnabledFilter);
    if (proveedorFilter) params.append('proveedor', proveedorFilter);
    const response = await this.api.get(`/api/grupos?${params}`);
    return response.data;
  }

  async createGrupo(data: Partial<Group>) {
    const response = await this.api.post('/api/grupos', data);
    return response.data;
  }

  async updateGrupo(idOrJid: string | number, data: Partial<Group>) {
    const response = await this.api.put(`/api/grupos/${idOrJid}`, data);
    return response.data;
  }

  async deleteGrupo(idOrJid: number | string) {
    const response = await this.api.delete(`/api/grupos/${idOrJid}`);
    return response.data;
  }

  async toggleProvider(idOrJid: string | number, es_proveedor: boolean) {
    const response = await this.api.patch(`/api/grupos/${idOrJid}/proveedor`, { es_proveedor });
    return response.data;
  }

  // Aportes
  async getAportes(page = 1, limit = 20, search?: string, estado?: string, fuente?: string, tipo?: string) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (search) params.append('search', search);
    if (estado) params.append('estado', estado);
    if (fuente) params.append('fuente', fuente);
    if (tipo) params.append('tipo', tipo);
    const response = await this.api.get(`/api/aportes?${params}`);
    return response.data;
  }

  async createAporte(aporte: Partial<Aporte>) {
    const response = await this.api.post('/api/aportes', aporte);
    return response.data;
  }

  async updateAporte(id: number, aporte: Partial<Aporte>) {
    const response = await this.api.patch(`/api/aportes/${id}`, aporte);
    return response.data;
  }

  async deleteAporte(id: number) {
    const response = await this.api.delete(`/api/aportes/${id}`);
    return response.data;
  }

  async approveAporte(id: number, estado: string, motivo_rechazo?: string) {
    const response = await this.api.patch(`/api/aportes/${id}/estado`, { estado, motivo_rechazo });
    return response.data;
  }

  // Pedidos
  async getPedidos(page = 1, limit = 20, search?: string, estado?: string, prioridad?: string) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (search) params.append('search', search);
    if (estado) params.append('estado', estado);
    if (prioridad) params.append('prioridad', prioridad);
    const response = await this.api.get(`/api/pedidos?${params}`);
    return response.data;
  }

  async createPedido(pedido: Partial<Pedido>) {
    const response = await this.api.post('/api/pedidos', pedido);
    return response.data;
  }

  async updatePedido(id: number, pedido: Partial<Pedido>) {
    const response = await this.api.patch(`/api/pedidos/${id}`, pedido);
    return response.data;
  }

  async deletePedido(id: number) {
    const response = await this.api.delete(`/api/pedidos/${id}`);
    return response.data;
  }

  async resolvePedido(id: number, aporte_id?: number) {
    const response = await this.api.patch(`/api/pedidos/${id}/resolver`, { aporte_id });
    return response.data;
  }

  // Usuarios
  async getUsuarios(page = 1, limit = 20, search?: string, rol?: string) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (search) params.append('search', search);
    if (rol && rol !== 'all') params.append('rol', rol);
    const response = await this.api.get(`/api/usuarios?${params}`);
    return response.data;
  }

  async createUsuario(usuario: Partial<User> & { password: string }) {
    const response = await this.api.post('/api/usuarios', usuario);
    return response.data;
  }

  async updateUsuario(id: number, usuario: Partial<User> & { password?: string }) {
    const response = await this.api.patch(`/api/usuarios/${id}`, usuario);
    return response.data;
  }

  async deleteUsuario(id: number) {
    const response = await this.api.delete(`/api/usuarios/${id}`);
    return response.data;
  }

  async changeUsuarioPassword(id: number, newPassword: string) {
    const response = await this.api.post(`/api/usuarios/${id}/password`, { newPassword });
    return response.data;
  }

  // Proveedores
  async getProveedores(page = 1, limit = 20, search?: string) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (search) params.append('search', search);
    const response = await this.api.get(`/api/proveedores?${params}`);
    return response.data;
  }

  async createProveedor(data: Partial<Proveedor>) {
    const response = await this.api.post('/api/proveedores', data);
    return response.data;
  }

  async updateProveedor(id: number, data: Partial<Proveedor>) {
    const response = await this.api.patch(`/api/proveedores/${id}`, data);
    return response.data;
  }

  // Logs
  async getLogs(page = 1, limit = 50, level?: string) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (level) params.append('level', level);
    const response = await this.api.get(`/api/logs?${params}`);
    return response.data;
  }

  async clearLogs() {
    const response = await this.api.delete('/api/logs');
    return response.data;
  }

  // Notificaciones
  async getNotificaciones(page = 1, limit = 20, filters?: { search?: string; type?: string; category?: string; read?: string }) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.type && filters.type !== 'all') params.append('type', filters.type);
    if (filters?.category && filters.category !== 'all') params.append('category', filters.category);
    if (filters?.read && filters.read !== 'all') params.append('read', filters.read);
    const response = await this.api.get(`/api/notificaciones?${params}`);
    return response.data;
  }

  async markAsRead(id: number) {
    const response = await this.api.patch(`/api/notificaciones/${id}/read`);
    return response.data;
  }

  async markAllAsRead() {
    const response = await this.api.patch('/api/notificaciones/read-all');
    return response.data;
  }

  async deleteNotification(id: number) {
    const response = await this.api.delete(`/api/notificaciones/${id}`);
    return response.data;
  }

  // AI
  async sendAIMessage(data: { message: string; model: string; context?: string }) {
    const response = await this.api.post('/api/ai/chat', data);
    return response.data;
  }

  // Analytics
  async getAnalytics(timeRange?: string) {
    const params = timeRange ? `?timeRange=${timeRange}` : '';
    const response = await this.api.get(`/api/analytics${params}`);
    return response.data;
  }

  // Multimedia
  async getMultimediaItems(options: { page?: number; limit?: number; search?: string; type?: string } = {}) {
    const params = new URLSearchParams();
    if (options.page) params.append('page', String(options.page));
    if (options.limit) params.append('limit', String(options.limit));
    if (options.search) params.append('search', options.search);
    if (options.type && options.type !== 'all') params.append('type', options.type);
    const response = await this.api.get(`/api/multimedia?${params}`);
    return response.data;
  }

  async uploadMultimedia(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.api.post('/api/multimedia/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }

  async deleteMultimedia(id: number) {
    const response = await this.api.delete(`/api/multimedia/${id}`);
    return response.data;
  }

  // System
  async getSystemStats() {
    const response = await this.api.get('/api/system/stats');
    return response.data;
  }

  async updateSystemConfig(config: any) {
    const response = await this.api.patch('/api/system/config', config);
    return response.data;
  }

  // Bot Commands
  async executeBotCommand(command: string, groupId?: string) {
    const response = await this.api.post('/api/bot/execute', { command, groupId });
    return response.data;
  }

  async getBotCommandHelp(category?: string) {
    const params = category ? `?category=${category}` : '';
    const response = await this.api.get(`/api/bot/help${params}`);
    return response.data;
  }

  // Bot Global State
  async setBotGlobalState(isOn: boolean) {
    const response = await this.api.post('/api/bot/global-state', { isOn });
    return response.data;
  }

  async getBotGlobalState() {
    const response = await this.api.get('/api/bot/global-state');
    return response.data;
  }

  async getBotGlobalOffMessage() {
    const response = await this.api.get('/api/bot/global-off-message');
    return response.data;
  }

  async setBotGlobalOffMessage(message: string) {
    const response = await this.api.post('/api/bot/global-off-message', { message });
    return response.data;
  }

  async shutdownBotGlobally() {
    const response = await this.api.post('/api/bot/global-shutdown');
    return response.data;
  }

  async startupBotGlobally() {
    const response = await this.api.post('/api/bot/global-startup');
    return response.data;
  }

  // Groups Management
  async getGroupsManagement() {
    const response = await this.api.get('/api/grupos/management');
    return response.data;
  }

  async toggleGroupBot(groupId: string, action: 'on' | 'off') {
    const response = await this.api.post(`/api/grupos/${groupId}/toggle`, { action });
    return response.data;
  }

  async authorizeGroup(jid: string | number, enabled: boolean) {
    return this.updateGrupo(jid, { bot_enabled: enabled } as any);
  }

  async getAvailableGrupos() {
    const response = await this.api.get('/api/grupos/available');
    return response.data;
  }

  async getGroupStats() {
    const response = await this.api.get('/api/grupos/stats');
    return response.data;
  }

  // Aportes Stats
  async getAporteStats() {
    const response = await this.api.get('/api/aportes/stats');
    return response.data;
  }

  // Pedidos Stats
  async getPedidoStats() {
    const response = await this.api.get('/api/pedidos/stats');
    return response.data;
  }

  // Usuarios Stats
  async getUsuarioStats() {
    const response = await this.api.get('/api/usuarios/stats');
    return response.data;
  }

  async viewUsuarioPassword(id: number) {
    const response = await this.api.get(`/api/usuarios/${id}/view-password`);
    return response.data;
  }

  async updateUsuarioEstado(id: number, estado: string) {
    const response = await this.api.patch(`/api/usuarios/${id}/estado`, { estado });
    return response.data;
  }

  // Proveedores Stats
  async getProviderStats() {
    const response = await this.api.get('/api/proveedores/stats');
    return response.data;
  }

  async deleteProvider(jid: string) {
    const response = await this.api.delete(`/api/proveedores/${encodeURIComponent(jid)}`);
    return response.data;
  }

  // Bot Configuration
  async getBotConfig() {
    const response = await this.api.get('/api/bot/config');
    return response.data;
  }

  async updateBotConfig(config: any) {
    const response = await this.api.patch('/api/bot/config', config);
    return response.data;
  }

  // Voting system
  async votePedido(id: number) {
    const response = await this.api.post(`/api/pedidos/${id}/vote`);
    return response.data;
  }

  // Real multimedia stats
  async getMultimediaStats() {
    const response = await this.api.get('/api/multimedia/stats');
    return response.data;
  }

  // Notification Stats
  async getNotificationStats() {
    const response = await this.api.get('/api/notificaciones/stats');
    return response.data;
  }

  async createNotification(notification: { title: string; message: string; type: string; category: string }) {
    const response = await this.api.post('/api/notificaciones', notification);
    return response.data;
  }

  // Bot Commands Stats
  async getBotCommandStats() {
    const response = await this.api.get('/api/bot/stats');
    return response.data;
  }

  async getPopularBotCommands() {
    const response = await this.api.get('/api/bot/popular');
    return response.data;
  }

  async getBotCommandCategories() {
    const response = await this.api.get('/api/bot/categories');
    return response.data;
  }

  // Export Logs
  async exportLogs() {
    const response = await this.api.get('/api/logs/export');
    return response.data;
  }

  // Custom Commands
  async getCustomCommands() {
    const response = await this.api.get('/api/custom-commands');
    return response.data;
  }

  async createCustomCommand(command: any) {
    const response = await this.api.post('/api/custom-commands', command);
    return response.data;
  }

  async updateCustomCommand(id: number, command: any) {
    const response = await this.api.patch(`/api/custom-commands/${id}`, command);
    return response.data;
  }

  async deleteCustomCommand(id: number) {
    const response = await this.api.delete(`/api/custom-commands/${id}`);
    return response.data;
  }

  async testCustomCommand(trigger: string) {
    const response = await this.api.post('/api/custom-commands/test', { trigger });
    return response.data;
  }

  // Scheduled Messages
  async getScheduledMessages() {
    const response = await this.api.get('/api/scheduled-messages');
    return response.data;
  }

  async createScheduledMessage(message: any) {
    const response = await this.api.post('/api/scheduled-messages', message);
    return response.data;
  }

  async updateScheduledMessage(id: number, message: any) {
    const response = await this.api.patch(`/api/scheduled-messages/${id}`, message);
    return response.data;
  }

  async deleteScheduledMessage(id: number) {
    const response = await this.api.delete(`/api/scheduled-messages/${id}`);
    return response.data;
  }

  async sendScheduledMessageNow(id: number) {
    const response = await this.api.post(`/api/scheduled-messages/${id}/send-now`);
    return response.data;
  }

  // System Alerts
  async getSystemAlerts() {
    const response = await this.api.get('/api/system/alerts');
    return response.data;
  }

  async markAlertAsRead(id: number) {
    const response = await this.api.patch(`/api/system/alerts/${id}`, { read: true });
    return response.data;
  }

  // Community Users
  async getCommunityUsers(page = 1, limit = 20, search?: string, status?: string, role?: string) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (search) params.append('search', search);
    if (status && status !== 'all') params.append('status', status);
    if (role && role !== 'all') params.append('role', role);
    const response = await this.api.get(`/api/community/users?${params}`);
    return response.data;
  }

  async getCommunityStats() {
    const response = await this.api.get('/api/community/stats');
    return response.data;
  }

  async banCommunityUser(jid: string, banned: boolean) {
    const response = await this.api.post(`/api/community/users/${encodeURIComponent(jid)}/ban`, { banned });
    return response.data;
  }

  async promoteCommunityUser(jid: string, role: string) {
    const response = await this.api.post(`/api/community/users/${encodeURIComponent(jid)}/promote`, { role });
    return response.data;
  }

  // Recent Activity
  async getRecentActivity(limit = 10) {
    const response = await this.api.get(`/api/dashboard/recent-activity?limit=${limit}`);
    return response.data;
  }
}

export const api = new ApiService();
export default api;