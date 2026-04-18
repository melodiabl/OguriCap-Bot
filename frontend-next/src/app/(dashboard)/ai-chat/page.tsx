'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Bot, Send, User, Sparkles, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SimpleSelect } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { Reveal } from '@/components/motion/Reveal';
import api from '@/services/api';
import toast from 'react-hot-toast';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const MODEL_OPTIONS = [
  { value: 'gemini', label: 'Gemini' },
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { value: 'claude', label: 'Claude' },
  { value: 'qwen', label: 'Qwen' },
  { value: 'luminai', label: 'Luminai' },
  { value: 'chatgpt', label: 'ChatGPT' },
];

export default function AiChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState('gemini');
  const [sessionId, setSessionId] = useState(() => `session-${Date.now()}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [messages, reduceMotion]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await api.sendAIMessage({
        message: input,
        model,
        sessionId,
      });

      if (response?.error) toast.error(`El modelo respondió con error: ${response.error}`);

      const assistantMessage: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.response || response.content || 'Sin respuesta',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      toast.error('Error al enviar mensaje');
      const errorMessage: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Lo siento, hubo un error al procesar tu mensaje.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const aiLanes = [
    {
      label: 'Modelo activo',
      value: MODEL_OPTIONS.find((option) => option.value === model)?.label || model,
      description: 'Motor seleccionado para la conversación actual.',
      icon: <Sparkles className="w-4 h-4" />,
      badge: 'model',
      badgeClassName: 'border-violet-400/20 bg-violet-500/10 text-violet-300',
      glowClassName: 'from-violet-400/18 via-oguri-lavender/10 to-transparent',
    },
    {
      label: 'Mensajes',
      value: `${messages.length}`,
      description: messages.length > 0 ? 'Cantidad acumulada en la sesión actual.' : 'Todavía no comenzó la conversación.',
      icon: <Bot className="w-4 h-4" />,
      badge: messages.length > 0 ? 'active' : 'idle',
      badgeClassName: messages.length > 0 ? 'border-oguri-cyan/20 bg-oguri-cyan/10 text-oguri-cyan' : 'border-white/10 bg-white/[0.05] text-white/70',
      glowClassName: 'from-oguri-cyan/18 via-oguri-blue/10 to-transparent',
    },
    {
      label: 'Estado',
      value: isLoading ? 'Pensando...' : 'Listo para responder',
      description: isLoading ? 'La IA está procesando el último mensaje.' : 'Puedes seguir escribiendo en la misma sesión.',
      icon: <RefreshCw className="w-4 h-4" />,
      badge: isLoading ? 'busy' : 'ready',
      badgeClassName: isLoading ? 'border-amber-400/20 bg-amber-500/10 text-amber-300' : 'border-[#25d366]/20 bg-[#25d366]/10 text-[#c7f9d8]',
      glowClassName: 'from-amber-400/18 via-oguri-gold/10 to-transparent',
    },
    {
      label: 'Sesión',
      value: sessionId.slice(-8),
      description: 'Identificador corto para mantener continuidad del chat.',
      icon: <User className="w-4 h-4" />,
      badge: 'session',
      badgeClassName: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300',
      glowClassName: 'from-emerald-400/18 via-oguri-cyan/10 to-transparent',
    },
  ];

  return (
    <div className="panel-page relative flex min-h-0 min-h-full flex-col overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[-8%] top-[-4rem] -z-10 h-[420px] overflow-hidden">
        <div className="module-atmosphere" />
        <motion.div
          className="absolute left-[8%] top-[12%] h-52 w-52 rounded-full bg-oguri-lavender/18 blur-3xl"
          animate={reduceMotion ? { opacity: 0.28 } : { x: [0, 18, 0], y: [0, 14, 0], opacity: [0.18, 0.38, 0.18] }}
          transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 10.8, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-[10%] top-[10%] h-56 w-56 rounded-full bg-oguri-cyan/18 blur-3xl"
          animate={reduceMotion ? { opacity: 0.24 } : { x: [0, -18, 0], y: [0, 18, 0], opacity: [0.18, 0.4, 0.18] }}
          transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 11.2, ease: 'easeInOut', delay: 0.5 }}
        />
      </div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-6 overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(var(--page-a),0.18),rgba(var(--page-b),0.10),rgba(var(--page-c),0.12))] p-5 shadow-[0_28px_90px_-44px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-6"
      >
        <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="relative z-10 grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="panel-live-pill mb-3 w-fit">
              <Sparkles className="h-3.5 w-3.5 text-oguri-cyan" />
              Copiloto conversacional
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Chat AI con más presencia de cabina</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-gray-300">
              Conversa, cambia de modelo y mantén continuidad del contexto desde una vista más viva que el chat plano original.
            </p>
          </div>
          <div className="panel-hero-meta-grid">
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Modelo</p>
              <p className="mt-2 text-lg font-black text-white">{MODEL_OPTIONS.find((option) => option.value === model)?.label || model}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Mensajes</p>
              <p className="mt-2 text-lg font-black text-white">{messages.length}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Estado</p>
              <p className="mt-2 text-lg font-black text-white">{isLoading ? 'BUSY' : 'READY'}</p>
            </div>
          </div>
        </div>
      </motion.div>

      <PageHeader
        title="AI Chat"
        description="Conversa con la inteligencia artificial"
        icon={<Sparkles className="w-5 h-5 text-primary" />}
        actions={
          <>
            <div className="w-full sm:w-52">
              <SimpleSelect
                value={model}
                onChange={setModel}
                options={MODEL_OPTIONS}
                placeholder="Modelo"
                disabled={isLoading}
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={() => {
                setMessages([]);
                setSessionId(`session-${Date.now()}`);
              }}
            >
              Limpiar
            </Button>
          </>
        }
        className="mb-6"
      />

      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {aiLanes.map((lane, index) => (
          <motion.div
            key={lane.label}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 + index * 0.05, duration: 0.3 }}
            className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-[#101512]/86 p-4 shadow-[0_22px_70px_-36px_rgba(0,0,0,0.4)]"
          >
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${lane.glowClassName}`} />
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <div className="relative z-10">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white">
                  {lane.icon}
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${lane.badgeClassName}`}>
                  {lane.badge}
                </span>
              </div>
              <div className="mt-4">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500">{lane.label}</p>
                <p className="mt-1 text-base font-black text-white">{lane.value}</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-400">{lane.description}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <Reveal className="flex-1 min-h-0">
        <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-3xl bg-primary/12 border border-primary/20 flex items-center justify-center mb-4">
                <Sparkles className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-xl font-extrabold text-foreground mb-2">¡Hola! Soy tu asistente AI</h3>
              <p className="text-muted max-w-md text-balance">
                Puedo ayudarte con preguntas sobre el bot, comandos, o cualquier otra cosa.
              </p>
            </div>
          ) : (
            messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduceMotion ? { duration: 0 } : { delay: index < 8 ? index * 0.04 : 0 }}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-2xl bg-primary/12 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className={`max-w-[88%] break-words p-4 [overflow-wrap:anywhere] sm:max-w-[72%] ${
                  message.role === 'user'
                    ? 'bg-primary/85 text-[rgb(var(--text-on-accent)/1)] rounded-br-sm'
                    : 'bg-card/20 border border-border/20 text-foreground/90 rounded-bl-sm'
                }`}>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <p className={`text-xs mt-2 ${message.role === 'user' ? 'text-[rgb(var(--text-on-accent)/0.80)]' : 'text-muted/80'}`}>
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-2xl bg-success/12 border border-success/20 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-success" />
                  </div>
                )}
              </motion.div>
            ))
          )}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-2xl bg-primary/12 border border-primary/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-card/20 border border-border/20 p-4 rounded-2xl rounded-bl-sm">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-muted animate-bounce" />
                  <div className="w-2 h-2 rounded-full bg-muted animate-bounce animation-delay-150" />
                  <div className="w-2 h-2 rounded-full bg-muted animate-bounce animation-delay-300" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border/20">
          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu mensaje..."
              className="input-glass flex-1 resize-none"
              rows={1}
              disabled={isLoading}
            />
            <Button variant="primary" onClick={handleSend} disabled={!input.trim() || isLoading} loading={isLoading}>
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
        </Card>
      </Reveal>
    </div>
  );
}
