import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, X, Mail, ExternalLink, RefreshCw, Send, Lock, Unlock, Users, ArrowLeft } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { cn } from '@/lib/utils';

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
    <div className="panel-surface-soft flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="panel-card-icon h-10 w-10 rounded-xl">
          <MessageCircle className="w-5 h-5" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>
              Volver
            </Button>
            <span className="badge badge-info">{canManage ? 'Inbox de Soporte' : 'Chat de Soporte'}</span>
          </div>
          <p className="mt-2 text-sm text-[rgb(var(--text-secondary))]">
            {canManage ? 'Gestiona conversaciones activas desde el panel.' : 'Escribe y recibe ayuda sin salir del panel.'}
          </p>
        </div>
      </div>
      <div className="panel-actions-wrap sm:justify-end">
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
        <div className="panel-empty-state min-h-[220px]">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-[rgb(var(--text-secondary))]">Cargando soporte...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}

      <div className={canManage ? 'grid grid-cols-1 gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]' : 'grid grid-cols-1 gap-4'}>
        {canManage && (
          <div className="panel-side-shell max-h-[60vh] overflow-y-auto">
            <div className="mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-muted" />
              <p className="text-sm font-semibold text-foreground">Chats</p>
            </div>
            {chats.length === 0 ? (
              <div className="panel-empty-state min-h-[180px] p-6">
                <Users className="h-10 w-10 text-muted" />
                <p className="text-sm text-[rgb(var(--text-secondary))]">No hay chats</p>
              </div>
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
                      className={cn(
                        'panel-surface-soft w-full p-3 text-left transition-all',
                        active ? 'border-primary/30 bg-primary/10 shadow-[0_16px_34px_-24px_rgba(var(--primary),0.32)]' : 'hover:border-border/20 hover:bg-card/80'
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold text-foreground">{ownerName}</p>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            status === 'open' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'
                          }`}
                        >
                          {status === 'open' ? 'Abierto' : 'Cerrado'}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-[rgb(var(--text-secondary))]">{c.lastMessage || '—'}</p>
                      <p className="mt-1 text-[11px] text-muted">{formatTime(c.updated_at || c.created_at)}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

          <div className={canManage ? 'min-w-0' : ''}>
            <div className="panel-setting-row mb-3">
              <div className="flex items-center gap-2">
                {chat?.status === 'closed' ? (
                  <Lock className="w-4 h-4 text-muted" />
                ) : (
                  <Unlock className="w-4 h-4 text-emerald-400" />
                )}
                <p className="text-sm text-[rgb(var(--text-secondary))]">
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
            className="panel-editor-shell min-h-[240px] max-h-[60vh] overflow-y-auto p-3 sm:min-h-[320px] sm:p-4"
          >
            {!chat ? (
              <div className="panel-empty-state min-h-[200px]">
                <MessageCircle className="h-12 w-12 text-muted" />
                <p className="text-[rgb(var(--text-secondary))]">Aún no hay mensajes.</p>
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
                    ? 'border border-primary/20 bg-primary/12 text-foreground'
                    : fromStaff
                    ? 'border border-emerald-500/20 bg-emerald-500/12 text-foreground'
                    : 'border border-border/15 bg-card/70 text-foreground';

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
                            <p className="text-xs text-[rgb(var(--text-secondary))]">{senderLabel}</p>
                            <p className="text-[11px] text-muted">{formatTime(m.created_at)}</p>
                          </div>
                          <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>
                        </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
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
          className="absolute bottom-4 right-4 pointer-events-auto touch-none select-none cursor-grab active:cursor-grabbing sm:bottom-6 sm:right-6"
          drag
          dragMomentum={false}
          dragConstraints={constraintsRef}
          whileTap={{ scale: 0.98 }}
        >
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="group relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-border/20 bg-card/90 shadow-[0_20px_45px_-20px_rgba(var(--shadow-rgb),0.45)] backdrop-blur-2xl transition-all hover:-translate-y-0.5 hover:border-primary/30 sm:h-auto sm:w-auto sm:justify-start sm:gap-3 sm:px-3.5 sm:py-2.5"
            title="Soporte"
          >
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/12 via-secondary/10 to-accent/12 opacity-90" />
            <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-oguri-primary text-white shadow-glow-oguri-purple">
              <MessageCircle className="w-5 h-5" />
            </span>
            <span className="relative hidden text-left sm:block">
              <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-[rgb(var(--text-secondary))]">Soporte</span>
              <span className="block text-sm font-semibold text-foreground">Abrir ayuda</span>
            </span>
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
          <div className="space-y-5">
            <div className="panel-stack-center rounded-[28px] border border-border/15 bg-card/60 p-6 text-center">
              <div className="panel-card-icon h-14 w-14 rounded-3xl">
                <MessageCircle className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-xl font-black tracking-tight text-foreground">Centro de Soporte</h3>
              <p className="mt-2 max-w-md text-sm text-[rgb(var(--text-secondary))]">
                Abre un chat dentro del panel o usa tus canales externos si prefieres WhatsApp, email o una URL de soporte.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button
                variant="primary"
                className="w-full justify-between"
                icon={<MessageCircle className="w-4 h-4" />}
                onClick={() => setView('chat')}
              >
                Abrir Chat de Soporte
              </Button>
              {whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noreferrer" className="block">
                  <Button variant="success" className="w-full justify-between" icon={<ExternalLink className="w-4 h-4" />}>
                    WhatsApp
                  </Button>
                </a>
              )}
              {emailUrl && (
                <a href={emailUrl} className="block">
                  <Button variant="secondary" className="w-full justify-between" icon={<Mail className="w-4 h-4" />}>
                    Email
                  </Button>
                </a>
              )}
              {supportUrl && (
                <a href={supportUrl} target="_blank" rel="noreferrer" className="block">
                  <Button variant="secondary" className="w-full justify-between" icon={<ExternalLink className="w-4 h-4" />}>
                    Abrir Soporte
                  </Button>
                </a>
              )}
            </div>

            <div className="panel-modal-actions">
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
