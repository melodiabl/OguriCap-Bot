import axios, { AxiosInstance } from 'axios'
import { User, BotStatus, Aporte, Pedido, Proveedor, Group, DashboardStats } from '@/types'

const API_URL =
  process.env.NODE_ENV === 'production'
    ? ''
    : ((process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim()) || '')

class ApiService {
  private api: AxiosInstance

  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
      withCredentials: true,
    })

    this.api.interceptors.request.use((config) => {
      if (typeof window !== 'undefined') {
        let token = localStorage.getItem('token')
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
        return Promise.reject(error)
      }
    )
  }

  // Auth
  async login(username: string, password: string, role?: string) {
    const response = await this.api.post('/api/auth/login', { username, password, role })
    return response.data
  }
  
  async getMe() {
    const response = await this.api.get('/api/auth/me')
    return response.data
  }

  // Notificaciones
  async getNotificaciones(page = 1, limit = 20, filters = {}) {
    const offset = (page - 1) * limit;
    const params = new URLSearchParams({ offset: String(offset), limit: String(limit), ...filters });
    const response = await this.api.get(`/api/notifications?${params}`);
    return response.data;
  }

  async markNotificationRead(id: number) {
    const response = await this.api.patch(`/api/notifications/${id}/read`);
    return response.data;
  }

  async markAllNotificationsRead() {
    const response = await this.api.post('/api/notifications/mark-all-read');
    return response.data;
  }

  async deleteNotification(id: number) {
    const response = await this.api.delete(`/api/notifications/${id}`);
    return response.data;
  }

  // Bot
  async getBotStatus(): Promise<BotStatus> {
    const response = await this.api.get('/api/bot/status')
    return response.data
  }

  // Dashboard
  async getStats(): Promise<DashboardStats> {
    const response = await this.api.get('/api/dashboard/stats')
    return response.data
  }

  // Otros
  async getGroups(page = 1, limit = 20) {
    const response = await this.api.get(`/api/grupos?page=${page}&limit=${limit}`);
    return response.data;
  }
  
  async getAportes(page = 1, limit = 20) {
    const response = await this.api.get(`/api/aportes?page=${page}&limit=${limit}`);
    return response.data;
  }

  async getPedidos(page = 1, limit = 20) {
    const response = await this.api.get(`/api/pedidos?page=${page}&limit=${limit}`);
    return response.data;
  }

  async getUsuarios(page = 1, limit = 20) {
    const response = await this.api.get(`/api/usuarios?page=${page}&limit=${limit}`);
    return response.data;
  }
  
  async getSystemStats() {
    const response = await this.api.get('/api/system/stats');
    return response.data;
  }

  async getRecentActivity(limit = 5) {
    const response = await this.api.get(`/api/logs/recent?limit=${limit}`);
    return response.data;
  }
}

const apiService = new ApiService()
export default apiService
