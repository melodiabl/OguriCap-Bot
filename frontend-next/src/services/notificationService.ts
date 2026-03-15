import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export interface Notification {
  id: number;
  titulo: string;
  mensaje: string;
  tipo: 'info' | 'success' | 'warning' | 'error' | 'system';
  categoria: string;
  leida: boolean;
  data: any;
  fecha_creacion: string;
}

export const notificationService = {
  async getAll(params?: { limit?: number; offset?: number; unread?: boolean }) {
    const response = await axios.get(`${API_URL}/notifications`, { params });
    return response.data;
  },

  async markAsRead(id: number) {
    const response = await axios.patch(`${API_URL}/notifications/${id}/read`);
    return response.data;
  },

  async markAllAsRead() {
    const response = await axios.post(`${API_URL}/notifications/mark-all-read`);
    return response.data;
  },

  async delete(id: number) {
    const response = await axios.delete(`${API_URL}/notifications/${id}`);
    return response.data;
  },

  async create(notification: Partial<Notification>) {
    const response = await axios.post(`${API_URL}/notifications`, notification);
    return response.data;
  }
};
