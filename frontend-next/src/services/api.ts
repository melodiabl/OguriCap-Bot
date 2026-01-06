import axios, { AxiosInstance } from 'axios'
import { User, BotStatus, Aporte, Pedido, Proveedor, Group, DashboardStats } from '@/types'

// ✅ PRODUCCIÓN: same-origin (Nginx enruta /api -> whatsapp-bot:8080)
// ✅ DEV: podés setear NEXT_PUBLIC_API_URL=http://localhost:8080
const API_URL =
  process.env.NODE_ENV === 'production'
    ? ''
    : ((process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim()) || '')

class ApiService {
  private api: AxiosInstance

  constructor() {
    this.api = axios.create({
      baseURL: API_URL, // '' => usa rutas relativas
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
      withCredentials: true,
    })

    this.api.interceptors.request.use((config) => {
      if (typeof window !== 'undefined') {
        let token = localStorage.getItem('token')

        // Fallback: cookie token (middleware/auth global)
        if (!token) {
          try {
            const parts = document.cookie.split(';').map((s) => s.trim())
            const found = parts.find((p) => p.startsWith('token='))
            if (found) token = decodeURIComponent(found.slice('token='.length))
          } catch {}
        }

        if (token) config.headers.Authorization = `Bearer ${token}`
      }
      return config
    })

    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 && typeof window !== 'undefined') {
          localStorage.removeItem('token')
          try {
            const secure = window.location.protocol === 'https:' ? '; Secure' : ''
            document.cookie = `token=; Path=/; Max-Age=0; SameSite=Lax${secure}`
          } catch {}
          if (window.location.pathname !== '/login') window.location.href = '/login'
        }
        if (error.response?.status === 503 && error.response?.data?.maintenanceMode && typeof window !== 'undefined') {
          // Verificar si el usuario es administrador antes de redirigir
          const userStr = localStorage.getItem('user')
          let isAdmin = false
          
          if (userStr) {
            try {
              const user = JSON.parse(userStr)
              isAdmin = ['owner', 'admin', 'administrador'].includes(user.rol)
            } catch {}
          }
          
          // Solo redirigir a mantenimiento si no es administrador
          if (!isAdmin && window.location.pathname !== '/maintenance') {
            // Mostrar notificación antes de redirigir
            if (typeof window !== 'undefined' && window.location.pathname !== '/maintenance') {
              // Crear una notificación temporal
              const notification = document.createElement('div')
              notification.className = 'maintenance-toast'
              notification.innerHTML = `
                <div class="maintenance-toast__inner">
                  <div class="maintenance-toast__row">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 2C13.1 2 14 2.9 14 4V8C14 9.1 13.1 10 12 10S10 9.1 10 8V4C10 2.9 10.9 2 12 2M21 9V7L19 8L21 9M3 9L5 8L3 7V9M12 11C13.1 11 14 11.9 14 13V17C14 18.1 13.1 19 12 19S10 18.1 10 17V13C10 11.9 10.9 11 12 11Z"/>
                    </svg>
                    <strong class="maintenance-toast__title">Sistema en Mantenimiento</strong>
                  </div>
                  <div class="maintenance-toast__desc">
                    Redirigiendo a la página de mantenimiento...
                  </div>
                </div>
              `
              document.body.appendChild(notification)
              
              // Remover la notificación después de 3 segundos
              setTimeout(() => {
                if (notification.parentNode) {
                  notification.parentNode.removeChild(notification)
                }
              }, 3000)
            }
            
            // Redirigir después de un breve delay
            setTimeout(() => {
              window.location.href = '/maintenance'
            }, 1500)
          }
        }
        return Promise.reject(error)
      }
    )
  }

  // Auth
  async login(username: string, password: string, role?: string) {
    if (!role) {
      throw new Error('Debes seleccionar un rol');
    }
    
    const response = await this.api.post('/api/auth/login', { 
      username, 
      password,
      role
    })
    return response.data
  }

  async register(userData: { username: string; password: string; rol: string; whatsapp_number?: string }) {
    const response = await this.api.post('/api/auth/register', userData);
    return response.data;
  }

  async registerPublic(userData: { email: string; username: string; password: string; whatsapp_number?: string }) {
    const response = await this.api.post('/api/auth/register-public', userData);
    return response.data;
  }

  async autoRegister(userData: { whatsapp_number: string; username: string; grupo_jid: string }) {
    const response = await this.api.post('/api/auth/auto-register', userData);
    return response.data;
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const response = await this.api.post('/api/auth/change-password', {
      currentPassword,
      newPassword
    });
    return response.data;
  }

  async resetPassword(username: string, whatsapp_number: string) {
    const response = await this.api.post('/api/auth/reset-password', {
      username,
      whatsapp_number
    });
    return response.data;
  }

  async getMe() {
    const response = await this.api.get('/api/auth/me')
    return response.data
  }

  async verifyToken() {
    const response = await this.api.get('/api/auth/verify')
    return response.data
  }

  async resetUserPassword(username: string, whatsapp_number: string) {
    const response = await this.api.post('/api/auth/reset-password', { username, whatsapp_number })
    return response.data
  }

  async requestPasswordResetEmail(identifier: string) {
    const response = await this.api.post('/api/auth/password-reset/request', { identifier })
    return response.data
  }

  async confirmPasswordReset(token: string, newPassword: string) {
    const response = await this.api.post('/api/auth/password-reset/confirm', { token, newPassword })
    return response.data
  }

  // Bot
  async getBotStatus(): Promise<BotStatus> {
    const response = await this.api.get('/api/bot/status')
    return response.data
  }

  async getBotQR() {
    const response = await this.api.get('/api/bot/qr')
    return response.data
  }

  async restartBot() {
    const response = await this.api.post('/api/bot/restart')
    return response.data
  }

  async disconnectBot() {
    const response = await this.api.post('/api/bot/disconnect')
    return response.data
  }

  async getMainBotStatus(): Promise<BotStatus> {
    const response = await this.api.get('/api/bot/main/status')
    return response.data
  }

  async getMainBotQR() {
    const response = await this.api.get('/api/bot/main/qr')
    return response.data
  }

  async getMainBotPairingCode() {
    const response = await this.api.get('/api/bot/main/pairing-code')
    return response.data
  }

  async setMainBotMethod(method: 'qr' | 'pairing', phoneNumber?: string) {
    const response = await this.api.post('/api/bot/main/method', { method, phoneNumber })
    return response.data
  }

  async connectMainBot(method: 'qr' | 'pairing', phoneNumber?: string) {
    const response = await this.api.post('/api/bot/main/connect', { method, phoneNumber })
    return response.data
  }

  async disconnectMainBot() {
    const response = await this.api.post('/api/bot/main/disconnect')
    return response.data
  }

  async restartMainBot(method?: 'qr' | 'pairing', phoneNumber?: string) {
    const response = await this.api.post('/api/bot/main/restart', { method, phoneNumber })
    return response.data
  }

  // Subbots
  async getSubbots() {
    const response = await this.api.get('/api/subbot/list')
    return response.data
  }

  async getSubbotStatus() {
    const response = await this.api.get('/api/subbot/status')
    return response.data
  }

  async createSubbot(userId: number, type: 'qr' | 'code', phoneNumber?: string) {
    const response = await this.api.post('/api/subbot/create', { userId, type, phoneNumber })
    return response.data
  }

  async deleteSubbot(subbotId: string) {
    const response = await this.api.delete(`/api/subbot/${subbotId}`)
    return response.data
  }

  async getSubbotQR(subbotId: string) {
    const response = await this.api.get(`/api/subbot/qr/${encodeURIComponent(subbotId)}`)
    return response.data
  }

  // Support chat (panel) - usado desde el botón flotante
  async getMySupportChat() {
    const response = await this.api.get('/api/support/my-chat')
    return response.data
  }

  async createOrSendMySupportChat(message: string) {
    const response = await this.api.post('/api/support/my-chat', { message })
    return response.data
  }

  async getSupportChats() {
    const response = await this.api.get('/api/support/chats')
    return response.data
  }

  async getSupportChat(chatId: number | string) {
    const response = await this.api.get(`/api/support/chats/${encodeURIComponent(String(chatId))}`)
    return response.data
  }

  async sendSupportMessage(chatId: number | string, message: string) {
    const response = await this.api.post(`/api/support/chats/${encodeURIComponent(String(chatId))}/messages`, { message })
    return response.data
  }

  async closeSupportChat(chatId: number | string) {
    const response = await this.api.post(`/api/support/chats/${encodeURIComponent(String(chatId))}/close`)
    return response.data
  }

  // Dashboard
  async getStats(): Promise<DashboardStats> {
    const [overview, pedidos] = await Promise.all([
      this.api.get('/api/dashboard/stats').then(r => r.data).catch(() => ({})),
      this.api.get('/api/pedidos/stats').then(r => r.data).catch(() => ({}))
    ])

    return {
      totalUsuarios: overview.totalUsuarios ?? overview.usuarios ?? 0,
      totalGrupos: overview.totalGrupos ?? overview.grupos ?? 0,
      totalAportes: overview.totalAportes ?? overview.aportes ?? 0,
      totalPedidos: overview.totalPedidos ?? overview.pedidos ?? 0,
      totalSubbots: overview.totalSubbots ?? overview.subbots ?? 0,
      usuariosActivos: overview.usuariosActivos || 0,
      gruposActivos: overview.gruposActivos || 0,
      aportesHoy: overview.aportesHoy || 0,
      pedidosHoy: pedidos.pedidosPendientes ?? overview.pedidosHoy ?? 0,
      mensajesHoy: overview.mensajesHoy || 0,
      comandosHoy: overview.comandosHoy || 0,
      totalMensajes: overview.totalMensajes || 0,
      totalComandos: overview.totalComandos || 0,
      actividadPorHora: Array.isArray(overview.actividadPorHora) ? overview.actividadPorHora : undefined,
      rendimiento: overview.rendimiento,
      tendencias: overview.tendencias,
      comunidad: overview.comunidad,
    }
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

  async syncWhatsAppGroups(opts?: { clearOld?: boolean }) {
    const response = await this.api.post('/api/grupos/sync', opts || {});
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

  async processPedidoWithLibrary(id: number, groupJid: string) {
    const response = await this.api.post(`/api/pedidos/${id}/process`, { groupJid });
    return response.data;
  }

  async getPedidoLibraryMatches(id: number) {
    const response = await this.api.get(`/api/pedidos/${id}/library-matches`);
    return response.data;
  }

  async sendLibraryItem(itemId: number, jid: string, opts?: { caption?: string; pedidoId?: number; markCompleted?: boolean }) {
    const response = await this.api.post(`/api/library/items/${itemId}/send`, {
      jid,
      caption: opts?.caption,
      pedidoId: opts?.pedidoId,
      markCompleted: typeof opts?.markCompleted === 'boolean' ? opts.markCompleted : undefined,
    });
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

  async getProveedor(idOrJid: string | number) {
    const response = await this.api.get(`/api/proveedores/${encodeURIComponent(String(idOrJid))}`);
    return response.data;
  }

  async getProveedorLibrary(idOrJid: string | number, params?: { page?: number; limit?: number; search?: string; category?: string }) {
    const qp = new URLSearchParams();
    qp.set('page', String(params?.page || 1));
    qp.set('limit', String(params?.limit || 20));
    if (params?.search) qp.set('search', params.search);
    if (params?.category && params.category !== 'all') qp.set('category', params.category);
    const suffix = qp.toString() ? `?${qp}` : '';
    const response = await this.api.get(`/api/proveedores/${encodeURIComponent(String(idOrJid))}/library${suffix}`);
    return response.data;
  }

  async uploadProveedorLibraryFile(idOrJid: string | number, file: File) {
    const form = new FormData();
    form.append('file', file);
    const response = await this.api.post(`/api/proveedores/${encodeURIComponent(String(idOrJid))}/library/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async deleteProveedorLibraryItem(idOrJid: string | number, itemId: number) {
    const response = await this.api.delete(`/api/proveedores/${encodeURIComponent(String(idOrJid))}/library/items/${itemId}`);
    return response.data;
  }

  // Logs
  async getLogs(params: {
    page?: number;
    limit?: number;
    level?: string;
    category?: string;
    query?: string;
    startDate?: string;
    endDate?: string;
  } = {}) {
    const qp = new URLSearchParams();
    qp.append('page', String(params.page || 1));
    qp.append('limit', String(params.limit || 50));
    if (params.level) qp.append('level', params.level);
    if (params.category) qp.append('category', params.category);
    if (params.query) qp.append('query', params.query);
    if (params.startDate) qp.append('startDate', params.startDate);
    if (params.endDate) qp.append('endDate', params.endDate);
    const response = await this.api.get(`/api/logs?${qp}`);
    return response.data;
  }

  async getLogsStats() {
    const response = await this.api.get('/api/logs/stats');
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
  async sendAIMessage(data: { message: string; model?: string; sessionId?: string }) {
    // Crear una sesión si no se proporciona
    const sessionId = data.sessionId || `session-${Date.now()}`;
    
    // Usar el endpoint real de IA
    const response = await this.api.post(`/api/chat/sessions/${sessionId}/messages`, {
      message: data.message,
      model: data.model || 'gpt-3.5-turbo'
    });
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

  async getSystemConfig() {
    const response = await this.api.get('/api/system/config');
    return response.data;
  }

  async updateSystemConfig(config: any) {
    const response = await this.api.patch('/api/system/config', config);
    return response.data;
  }

  async addCurrentIPAsAdmin() {
    const response = await this.api.post('/api/system/add-admin-ip');
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

  async viewUsuarioPassword(id: number, opts?: { reset?: boolean; deliver?: boolean; show?: boolean }) {
    const params = new URLSearchParams();
    if (opts?.reset) params.set('reset', '1');
    if (opts?.deliver === false) params.set('deliver', '0');
    if (opts?.show) params.set('show', '1');
    const qs = params.toString();
    const response = await this.api.get(`/api/usuarios/${id}/view-password${qs ? `?${qs}` : ''}`);
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
  async getConfig(configKey: string = 'main') {
    const response = await this.api.get(`/api/config/${encodeURIComponent(configKey)}`);
    return response.data;
  }

  async updateConfig(configKey: string = 'main', config: any) {
    const response = await this.api.put(`/api/config/${encodeURIComponent(configKey)}`, config);
    return response.data;
  }

  async getConfigStats() {
    const response = await this.api.get('/api/config/stats');
    return response.data;
  }

  async getConfigVersions(configKey: string = 'main', limit: number = 50) {
    const qp = new URLSearchParams();
    if (limit) qp.set('limit', String(limit));
    const suffix = qp.toString() ? `?${qp}` : '';
    const response = await this.api.get(`/api/config/${encodeURIComponent(configKey)}/versions${suffix}`);
    return response.data;
  }

  async rollbackConfig(configKey: string = 'main', versionId: string) {
    const response = await this.api.post(`/api/config/${encodeURIComponent(configKey)}/rollback`, { versionId });
    return response.data;
  }

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

  // Resources (Resource Monitor)
  async getResourcesStats() {
    const response = await this.api.get('/api/resources/stats');
    return response.data;
  }

  async getResourcesHistory(limit?: number) {
    const qp = new URLSearchParams();
    if (limit) qp.append('limit', String(limit));
    const suffix = qp.toString() ? `?${qp}` : '';
    const response = await this.api.get(`/api/resources/history${suffix}`);
    return response.data;
  }

  async startResourcesMonitoring(interval = 5000) {
    const response = await this.api.post('/api/resources/start', { interval });
    return response.data;
  }

  async stopResourcesMonitoring() {
    const response = await this.api.post('/api/resources/stop');
    return response.data;
  }

  async updateResourcesThresholds(thresholds: any) {
    const response = await this.api.put('/api/resources/thresholds', thresholds);
    return response.data;
  }

  // Tasks
  async getTasks() {
    const response = await this.api.get('/api/tasks');
    return response.data;
  }

  async getTaskExecutions(limit = 100) {
    const response = await this.api.get(`/api/tasks/executions?limit=${limit}`);
    return response.data;
  }

  async executeTask(taskId: string) {
    const response = await this.api.post(`/api/tasks/${encodeURIComponent(taskId)}/execute`);
    return response.data;
  }

  async updateTask(taskId: string, updates: any) {
    const response = await this.api.patch(`/api/tasks/${encodeURIComponent(taskId)}`, updates);
    return response.data;
  }

  async deleteTask(taskId: string) {
    const response = await this.api.delete(`/api/tasks/${encodeURIComponent(taskId)}`);
    return response.data;
  }

  // Alerts
  async getAlerts() {
    const response = await this.api.get('/api/alerts');
    return response.data;
  }

  async getAlertRules() {
    const response = await this.api.get('/api/alerts/rules');
    return response.data;
  }

  async acknowledgeAlert(alertId: string) {
    const response = await this.api.post(`/api/alerts/${encodeURIComponent(alertId)}/acknowledge`);
    return response.data;
  }

  async resolveAlert(alertId: string) {
    const response = await this.api.post(`/api/alerts/${encodeURIComponent(alertId)}/resolve`);
    return response.data;
  }

  async updateAlertRule(ruleId: string, updates: any) {
    const response = await this.api.patch(`/api/alerts/rules/${encodeURIComponent(ruleId)}`, updates);
    return response.data;
  }

  async suppressAlertRule(ruleId: string, duration: number) {
    const response = await this.api.post(`/api/alerts/rules/${encodeURIComponent(ruleId)}/suppress`, { duration });
    return response.data;
  }

  // Bulk operations
  async bulkUpdateGroups(updates: { jid: string; enabled: boolean }[]) {
    const response = await this.api.post('/api/grupos/bulk-update', { updates });
    return response.data;
  }

  async bulkDeleteNotifications(ids: number[]) {
    const response = await this.api.post('/api/notificaciones/bulk-delete', { ids });
    return response.data;
  }

  // Real-time stats
  async getRealtimeStats() {
    const response = await this.api.get('/api/stats/realtime');
    return response.data;
  }

  async getActivityFeed(limit = 20) {
    const response = await this.api.get(`/api/activity/feed?limit=${limit}`);
    return response.data;
  }

  // System health
  async getSystemHealth() {
    const response = await this.api.get('/api/system/health');
    return response.data;
  }

  async pingSystem() {
    const response = await this.api.get('/api/system/ping');
    return response.data;
  }

  // Cache management
  async clearCache(type?: string) {
    const params = type ? `?type=${type}` : '';
    const response = await this.api.post(`/api/system/clear-cache${params}`);
    return response.data;
  }

  // Backup and restore
  async createBackup(payload?: any) {
    const response = await this.api.post('/api/backups', payload || {});
    return response.data;
  }

  async getBackups() {
    const response = await this.api.get('/api/backups');
    return response.data;
  }

  // Advanced notifications
  async markNotificationAsRead(id: number) {
    const response = await this.api.patch(`/api/notificaciones/${id}/read`);
    return response.data;
  }

  async markAllNotificationsAsRead() {
    const response = await this.api.post('/api/notificaciones/mark-all-read');
    return response.data;
  }

  // WebSocket connection test
  async testWebSocketConnection() {
    const response = await this.api.get('/api/websocket/test');
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
