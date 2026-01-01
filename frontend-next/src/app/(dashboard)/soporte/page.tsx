 'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, RefreshCw, Send, Lock, Unlock, Users } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import toast from 'react-hot-toast';

type ChatStatus = 'open' | 'closed';

interface SupportMessage {
  id: number;
  senderRole: 'user' | 'staff';
  sender: string;
  text: string;
  created_at: string;
}

interface SupportChat {
  id: number;
  owner: string;
  status: ChatStatus;
  created_at: string;
  updated_at: string;
  messages: SupportMessage[];
}

interface SupportChatListItem {
  id: number;
  owner: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  lastMessage?: string;
  lastSender?: string;
}

function formatTime(ts?: string) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString('es-ES');
  } catch {
    return ts;
  }
}

export default function SoportePage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const canManage = useMemo(() => {
    const role = String(user?.rol || '').toLowerCase();
    return ['owner', 'admin', 'administrador'].includes(role);
  }, [user?.rol]);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  const [chat, setChat] = useState<SupportChat | null>(null);
  const [chats, setChats] = useState<SupportChatListItem[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const loadMyChat = useCallback(async () => {
    try {
      const res = await api.getMySupportChat();
      setChat((res as any)?.chat || null);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo cargar el chat');
    }
  }, []);

  const loadChats = useCallback(async () => {
    if (!canManage) return;
    try {
      setListLoading(true);
      const res = await api.getSupportChats();
      const items = (res as any)?.chats;
      setChats(Array.isArray(items) ? items : []);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudieron cargar los chats');
    } finally {
      setListLoading(false);
    }
  }, [canManage]);

  const loadChatById = useCallback(async (id: number) => {
    try {
      const res = await api.getSupportChat(id);
      setChat((res as any)?.chat || null);
      setSelectedChatId(id);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo cargar el chat');
    }
  }, []);

  const refresh = useCallback(async () => {
    if (canManage) {
      await Promise.all([loadChats(), selectedChatId ? loadChatById(selectedChatId) : Promise.resolve()]);
    } else {
      await loadMyChat();
    }
  }, [canManage, loadChats, loadChatById, selectedChatId, loadMyChat]);

  useEffect(() => {
    const boot = async () => {
      try {
        setLoading(true);

        const preselect = Number(searchParams?.get('chat') || 0) || null;
        if (canManage) {
          await loadChats();
          if (preselect) {
            await loadChatById(preselect);
          }
        } else {
          await loadMyChat();
        }
      } finally {
        setLoading(false);
      }
    };
    boot();
  }, [canManage, loadChats, loadChatById, loadMyChat, searchParams]);

  const sendMessage = async () => {
    const text = message.trim();
    if (!text) return;

    try {
      setSending(true);
      if (canManage) {
        if (!selectedChatId) {
          toast.error('Selecciona un chat');
          return;
        }
        const res = await api.sendSupportMessage(selectedChatId, text);
        setChat((res as any)?.chat || null);
        setMessage('');
        await loadChats();
      } else {
        const res = await api.createOrSendMySupportChat(text);
        setChat((res as any)?.chat || null);
        setMessage('');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  const closeChat = async () => {
    if (!chat?.id) return;
    try {
      const res = await api.closeSupportChat(chat.id);
      setChat((res as any)?.chat || chat);
      await loadChats();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo cerrar el chat');
    }
  };

  const title = canManage ? 'Soporte (Chats)' : 'Soporte';

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-violet-500/20 rounded-xl">
              <MessageCircle className="w-8 h-8 text-violet-400" />
            </div>
            {title}
          </h1>
          <p className="text-gray-400 mt-2">Inicia un chat con el equipo para recibir ayuda desde el panel</p>
        </div>
        <Button variant="secondary" icon={<RefreshCw className={`w-4 h-4 ${listLoading ? 'animate-spin' : ''}`} />} onClick={refresh}>
          Actualizar
        </Button>
      </motion.div>

      {loading ? (
        <Card className="p-6">
          <p className="text-gray-400">Cargando…</p>
        </Card>
      ) : (
        <div className={canManage ? 'grid grid-cols-1 lg:grid-cols-3 gap-6' : 'grid grid-cols-1 gap-6'}>
          {canManage && (
            <Card className="p-4 lg:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-gray-400" />
                <p className="text-sm text-gray-400">Chats</p>
              </div>
              <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
                {chats.length === 0 ? (
                  <p className="text-sm text-gray-500">No hay chats</p>
                ) : (
                  chats.map((c) => {
                    const active = selectedChatId === c.id;
                    const status = String(c.status || 'open');
                    return (
                      <button
                        key={c.id}
                        onClick={() => loadChatById(c.id)}
                        className={`w-full text-left p-3 rounded-xl border transition ${active ? 'border-primary-500/60 bg-primary-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-white truncate">{c.owner || 'usuario'}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${status === 'open' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
                            {status === 'open' ? 'Abierto' : 'Cerrado'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{c.lastMessage || '—'}</p>
                        <p className="text-[11px] text-gray-500 mt-1">{formatTime(c.updated_at || c.created_at)}</p>
                      </button>
                    );
                  })
                )}
              </div>
            </Card>
          )}

          <Card className={canManage ? 'p-4 lg:col-span-2' : 'p-4'}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {chat?.status === 'closed' ? (
                  <Lock className="w-4 h-4 text-gray-400" />
                ) : (
                  <Unlock className="w-4 h-4 text-emerald-400" />
                )}
                <p className="text-sm text-gray-400">
                  {chat ? `Chat #${chat.id} • ${chat.owner}` : 'Sin chat'}
                </p>
              </div>
              {chat && (
                <Button variant="secondary" size="sm" onClick={closeChat} disabled={chat.status === 'closed'}>
                  Cerrar
                </Button>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3 min-h-[360px] max-h-[55vh] overflow-y-auto">
              {!chat ? (
                <div className="text-center py-10">
                  <p className="text-gray-400">Escribe tu primer mensaje para iniciar el chat.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(chat.messages || []).map((m) => {
                    const mine = !canManage && m.senderRole === 'user';
                    const fromStaff = m.senderRole === 'staff';
                    const align = mine ? 'justify-end' : 'justify-start';
                    const bubble = mine
                      ? 'bg-primary-500/20 text-white'
                      : fromStaff
                      ? 'bg-emerald-500/15 text-gray-200'
                      : 'bg-white/10 text-gray-200';

                    return (
                      <div key={m.id} className={`flex ${align}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${bubble}`}>
                          <div className="flex items-center justify-between gap-3 mb-1">
                            <p className="text-xs text-gray-400 [html.light_&]:text-gray-600">
                              {fromStaff ? `Soporte (${m.sender})` : m.sender}
                            </p>
                            <p className="text-[11px] text-gray-500 [html.light_&]:text-gray-600">{formatTime(m.created_at)}</p>
                          </div>
                          <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                className="input-glass flex-1"
                placeholder={chat?.status === 'closed' ? 'Chat cerrado' : 'Escribe un mensaje…'}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={sending || chat?.status === 'closed' || (canManage && !selectedChatId)}
              />
              <Button
                variant="primary"
                icon={<Send className="w-4 h-4" />}
                onClick={sendMessage}
                loading={sending}
                disabled={chat?.status === 'closed' || (canManage && !selectedChatId)}
              >
                Enviar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
