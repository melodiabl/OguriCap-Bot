import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, X, Mail, ExternalLink, RefreshCw, Send, Lock, Unlock, Users, ArrowLeft } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';

function cleanPhoneNumber(input: string) {
  return String(input || '').replace(/[^0-9]/g, '');
}

type ChatStatus = 'open' | 'closed';

interface SupportMessage {
  id: number;
  senderRole: 'user' | 'staff';
  sender: string;
  senderDisplay?: string;
  senderEmail?: string;
  senderRoleName?: string;
  text: string;
  created_at: string;
}

interface SupportChat {
  id: number;
  owner: string;
  ownerDisplay?: string;
  ownerEmail?: string;
  ownerRoleName?: string;
  status: ChatStatus;
  created_at: string;
  updated_at: string;
  messages: SupportMessage[];
}

interface SupportChatListItem {
  id: number;
  owner: string;
  ownerDisplay?: string;
  ownerEmail?: string;
  ownerRoleName?: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  lastMessage?: string;
  lastSender?: string;
  lastSenderDisplay?: string;
  lastSenderRole?: string;
}

function formatTime(ts?: string) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString('es-ES');
  } catch {
    return ts;
  }
}

const SupportChatPanel: React.FC<{ onBack: () => void; onClose: () => void }> = ({ onBack, onClose }) => {
  const { user } = useAuth();
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

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chat?.messages?.length, selectedChatId]);

  const loadMyChat = useCallback(async () => {
    const res = await api.getMySupportChat();
    setChat((res as any)?.chat || null);
  }, []);

  const loadChats = useCallback(async () => {
    if (!canManage) return;
    setListLoading(true);
    try {
      const res = await api.getSupportChats();
      const items = (res as any)?.chats;
      setChats(Array.isArray(items) ? items : []);
    } finally {
      setListLoading(false);
    }
  }, [canManage]);

  const loadChatById = useCallback(async (id: number) => {
    const res = await api.getSupportChat(id);
    setChat((res as any)?.chat || null);
    setSelectedChatId(id);
  }, []);

  const refresh = useCallback(async () => {
    try {
      if (canManage) {
        await loadChats();
        if (selectedChatId) await loadChatById(selectedChatId);
      } else {
        await loadMyChat();
      }
    } catch {
      // silencioso (UI simple)
    }
  }, [canManage, loadChats, loadChatById, selectedChatId, loadMyChat]);

  useEffect(() => {
    const boot = async () => {
      try {
        setLoading(true);
        if (canManage) {
          await loadChats();
        } else {
          await loadMyChat();
        }
      } finally {
        setLoading(false);
      }
    };
    boot();
  }, [canManage, loadChats, loadMyChat]);

  const sendMessage = async () => {
    const text = message.trim();
    if (!text) return;

    setSending(true);
    try {
      if (canManage) {
        if (!selectedChatId) return;
        const res = await api.sendSupportMessage(selectedChatId, text);
        setChat((res as any)?.chat || null);
        setMessage('');
        await loadChats();
      } else {
        const res = await api.createOrSendMySupportChat(text);
        setChat((res as any)?.chat || null);
        setMessage('');
      }
    } finally {
      setSending(false);
    }
  };

  const closeChat = async () => {
    if (!chat?.id) return;
    if (!confirm('¿Cerrar este chat?')) return;
    try {
      const res = await api.closeSupportChat(chat.id);
      setChat((res as any)?.chat || chat);
      await loadChats();
    } catch {
      // ignore
    }
  };

  const header = (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>
          Volver
        </Button>
        <p className="text-sm text-gray-400 [html[data-theme=light]_&]:text-gray-600">
          {canManage ? 'Inbox de Soporte' : 'Chat con Soporte'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={refresh}
          icon={<RefreshCw className={`w-4 h-4 ${listLoading ? 'animate-spin' : ''}`} />}
        >
          Actualizar
        </Button>
        <Button variant="secondary" size="sm" onClick={onClose} icon={<X className="w-4 h-4" />}>
          Cerrar
        </Button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {header}
        <p className="text-sm text-gray-400 [html[data-theme=light]_&]:text-gray-600">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}

      <div className={canManage ? 'grid grid-cols-1 md:grid-cols-3 gap-4' : 'grid grid-cols-1 gap-4'}>
        {canManage && (
          <div className="md:col-span-1 rounded-xl border border-white/10 bg-white/5 p-3 max-h-[55vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-gray-400" />
              <p className="text-sm text-gray-400">Chats</p>
            </div>
            {chats.length === 0 ? (
              <p className="text-sm text-gray-500">No hay chats</p>
            ) : (
              <div className="space-y-2">
                {chats.map((c) => {
                  const active = selectedChatId === c.id;
                  const status = String(c.status || 'open');
                  const ownerName = String(c.ownerDisplay || c.owner || 'usuario');
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => loadChatById(c.id)}
                      className={`w-full text-left p-3 rounded-xl border transition ${
                        active ? 'border-primary-500/60 bg-primary-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white truncate">{ownerName}</p>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            status === 'open' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'
                          }`}
                        >
                          {status === 'open' ? 'Abierto' : 'Cerrado'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{c.lastMessage || '—'}</p>
                      <p className="text-[11px] text-gray-500 mt-1">{formatTime(c.updated_at || c.created_at)}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className={canManage ? 'md:col-span-2' : ''}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {chat?.status === 'closed' ? (
                <Lock className="w-4 h-4 text-gray-400" />
              ) : (
                <Unlock className="w-4 h-4 text-emerald-400" />
              )}
              <p className="text-sm text-gray-400">
                {chat
                  ? `Chat #${chat.id} • ${chat.ownerDisplay || chat.owner}`
                  : canManage
                    ? 'Selecciona un chat'
                    : 'Escribe para iniciar el chat'}
              </p>
            </div>
            {canManage && chat && (
              <Button variant="secondary" size="sm" onClick={closeChat} disabled={chat.status === 'closed'}>
                Cerrar chat
              </Button>
            )}
          </div>

          <div
            ref={scrollRef}
            className="rounded-xl border border-white/10 bg-white/5 p-3 min-h-[220px] md:min-h-[320px] max-h-[55vh] overflow-y-auto"
          >
            {!chat ? (
              <div className="text-center py-10">
                <p className="text-gray-400">Aún no hay mensajes.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(chat.messages || []).map((m) => {
                  const currentUsername = String(user?.username || '').trim();
                  const mine = canManage
                    ? m.senderRole === 'staff' && !!currentUsername && (m.sender === currentUsername || m.senderDisplay === currentUsername)
                    : m.senderRole === 'user';
                  const fromStaff = m.senderRole === 'staff';
                  const align = mine ? 'justify-end' : 'justify-start';
                  const bubble = mine
                    ? 'bg-primary-500/20 text-white'
                    : fromStaff
                    ? 'bg-emerald-500/15 text-gray-200'
                    : 'bg-white/10 text-gray-200';

                  const ownerName = String(chat?.ownerDisplay || chat?.owner || 'usuario');
                  const senderBase = fromStaff
                    ? String(m.senderDisplay || m.sender || 'Soporte')
                    : String(m.senderDisplay || (m.sender === 'usuario' ? ownerName : m.sender) || ownerName);
                  const senderRoleName = String(m.senderRoleName || '').trim();
                  const senderLabel = fromStaff
                    ? `Soporte (${senderBase}${senderRoleName ? ` • ${senderRoleName}` : ''})`
                    : senderBase;

                  return (
                    <div key={m.id} className={`flex ${align}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${bubble}`}>
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <p className="text-xs text-gray-400 [html[data-theme=light]_&]:text-gray-600">{senderLabel}</p>
                          <p className="text-[11px] text-gray-500 [html[data-theme=light]_&]:text-gray-600">{formatTime(m.created_at)}</p>
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
        </div>
      </div>
    </div>
  );
};

export const FloatingSupportButton: React.FC = () => {
  const constraintsRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'menu' | 'chat'>('menu');

  const { whatsappUrl, emailUrl, supportUrl } = useMemo(() => {
    const whatsapp = cleanPhoneNumber(process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '');
    const email = String(process.env.NEXT_PUBLIC_SUPPORT_EMAIL || '').trim();
    const url = String(process.env.NEXT_PUBLIC_SUPPORT_URL || '').trim();
    const message = encodeURIComponent(String(process.env.NEXT_PUBLIC_SUPPORT_MESSAGE || 'Hola, necesito ayuda con el panel.').trim());

    return {
      whatsappUrl: whatsapp ? `https://wa.me/${whatsapp}?text=${message}` : '',
      emailUrl: email ? `mailto:${email}` : '',
      supportUrl: url,
    };
  }, []);

  const closeModal = useCallback(() => {
    setOpen(false);
    setView('menu');
  }, []);

  return (
    <>
      <div ref={constraintsRef} className="fixed inset-0 z-50 pointer-events-none">
        <motion.div
          className="absolute bottom-6 right-6 pointer-events-auto touch-none select-none cursor-grab active:cursor-grabbing"
          drag
          dragMomentum={false}
          dragConstraints={constraintsRef}
          whileTap={{ scale: 0.98 }}
        >
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-14 w-14 rounded-full bg-gradient-to-br from-primary-500 to-violet-600 shadow-lg shadow-primary-500/20 border border-white/10 flex items-center justify-center hover:brightness-110 transition"
            title="Soporte"
          >
            <MessageCircle className="w-6 h-6 text-white" />
          </button>
        </motion.div>
      </div>

      {/* Importante: el Modal NO debe estar dentro de un contenedor con pointer-events-none */}
      <Modal
        isOpen={open}
        onClose={closeModal}
        // En vista "chat" evitamos el header del Modal porque ya renderizamos uno propio
        // (si no, queda doble header y en pantallas bajas se desajusta/recorta).
        title={view === 'chat' ? undefined : 'Soporte'}
        className={view === 'chat' ? 'max-w-4xl p-4 md:p-6' : undefined}
      >
        {view === 'chat' ? (
          <SupportChatPanel onBack={() => setView('menu')} onClose={closeModal} />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-400 [html[data-theme=light]_&]:text-gray-600">
              Abre un chat con soporte o contáctanos por WhatsApp/Email.
            </p>

            <div className="grid grid-cols-1 gap-3">
              <Button
                variant="primary"
                className="w-full justify-between"
                icon={<MessageCircle className="w-4 h-4" />}
                onClick={() => setView('chat')}
              >
                Abrir Chat de Soporte
              </Button>
              {whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noreferrer">
                  <Button variant="success" className="w-full justify-between" icon={<ExternalLink className="w-4 h-4" />}>
                    WhatsApp
                  </Button>
                </a>
              )}
              {emailUrl && (
                <a href={emailUrl}>
                  <Button variant="secondary" className="w-full justify-between" icon={<Mail className="w-4 h-4" />}>
                    Email
                  </Button>
                </a>
              )}
              {supportUrl && (
                <a href={supportUrl} target="_blank" rel="noreferrer">
                  <Button variant="secondary" className="w-full justify-between" icon={<ExternalLink className="w-4 h-4" />}>
                    Abrir Soporte
                  </Button>
                </a>
              )}
            </div>

            <div className="flex justify-end">
              <Button variant="secondary" onClick={closeModal} icon={<X className="w-4 h-4" />}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};
