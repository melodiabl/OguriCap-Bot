'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Bot, Send, User, Sparkles, RefreshCw, Trash2,
  Zap, Brain, Code2, MessageSquare, ChevronDown, Copy, Check
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { notify } from '@/lib/notif';
import api from '@/services/api';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  model?: string;
}

const MODELS = [
  { value: 'qwen', label: 'Qwen 3', badge: 'RÁPIDO', color: 'cyan', icon: Zap, desc: 'Motor rápido y eficiente' },
  { value: 'gemini', label: 'Gemini', badge: 'MULTI', color: 'blue', icon: Sparkles, desc: 'Razonamiento multimodal' },
  { value: 'claude', label: 'Claude', badge: 'PRECISO', color: 'violet', icon: Brain, desc: 'Análisis profundo' },
  { value: 'gpt-4', label: 'GPT-4', badge: 'PRO', color: 'green', icon: Code2, desc: 'Código y lógica avanzada' },
  { value: 'luminai', label: 'Luminai', badge: 'LIBRE', color: 'pink', icon: MessageSquare, desc: 'Conversación natural' },
] as const;

type ModelValue = typeof MODELS[number]['value'];

const modelColorMap: Record<string, string> = {
  cyan: 'border-oguri-cyan/30 bg-oguri-cyan/10 text-oguri-cyan shadow-[0_0_24px_rgba(45,212,191,0.15)]',
  blue: 'border-oguri-blue/30 bg-oguri-blue/10 text-oguri-blue shadow-[0_0_24px_rgba(45,212,191,0.15)]',
  violet: 'border-oguri-lavender/30 bg-oguri-lavender/10 text-oguri-lavender shadow-[0_0_24px_rgba(167,243,199,0.12)]',
  green: 'border-primary/30 bg-primary/10 text-primary shadow-[0_0_24px_rgba(37,211,102,0.15)]',
  pink: 'border-oguri-energy/30 bg-oguri-energy/10 text-oguri-energy shadow-[0_0_24px_rgba(255,77,141,0.15)]',
};

const modelBubbleMap: Record<string, string> = {
  cyan: 'border-oguri-cyan/20 bg-gradient-to-br from-oguri-cyan/10 to-oguri-blue/5',
  blue: 'border-oguri-blue/20 bg-gradient-to-br from-oguri-blue/10 to-oguri-cyan/5',
  violet: 'border-oguri-lavender/20 bg-gradient-to-br from-oguri-lavender/10 to-primary/5',
  green: 'border-primary/20 bg-gradient-to-br from-primary/10 to-oguri-cyan/5',
  pink: 'border-oguri-energy/20 bg-gradient-to-br from-oguri-energy/10 to-oguri-gold/5',
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="rounded-md border border-white/10 bg-white/[0.05] p-1 text-muted opacity-0 transition-all hover:text-foreground group-hover:opacity-100"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function TypingIndicator({ color }: { color: string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-2xl border px-4 py-3 ${modelBubbleMap[color]} backdrop-blur-sm`}>
      {[0, 0.18, 0.36].map((delay, i) => (
        <motion.div
          key={i}
          className="h-2 w-2 rounded-full bg-current opacity-60"
          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.1, delay, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

export default function AiChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState<ModelValue>('qwen');
  const [sessionId] = useState(() => `s-${Date.now().toString(36)}`);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const reduceMotion = useReducedMotion();

  const activeModel = MODELS.find(m => m.value === model) || MODELS[0];
  const activeColor = activeModel.color;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [messages, isLoading, reduceMotion]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { id: Date.now(), role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsLoading(true);

    try {
      const response = await api.sendAIMessage({ message: text, model, sessionId });
      const reply = response.response || response.content || 'Sin respuesta';
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'assistant', content: reply,
        timestamp: new Date(), model,
      }]);
    } catch {
      notify.error('Error al conectar con la IA');
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'assistant',
        content: 'Ocurrió un error al procesar tu mensaje. Intenta de nuevo.',
        timestamp: new Date(), model,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const clearChat = () => { setMessages([]); notify.success('Conversación limpiada'); };

  return (
    <div className="panel-page flex h-[calc(100dvh-var(--header-height,180px))] min-h-0 flex-col overflow-hidden">
      {/* Atmosphere */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 overflow-hidden opacity-60">
        <div className="absolute -left-20 top-0 h-64 w-64 rounded-full bg-[rgb(var(--page-a))/0.12] blur-[80px]" />
        <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-[rgb(var(--page-b))/0.10] blur-[70px]" />
        <div className="absolute left-1/2 top-8 h-48 w-48 -translate-x-1/2 rounded-full bg-[rgb(var(--page-c))/0.07] blur-[60px]" />
      </div>

      <PageHeader
        title="AI Chat"
        description={`Conversación con ${activeModel.label} · Sesión ${sessionId.slice(-6).toUpperCase()}`}
        actions={
          messages.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={clearChat} className="gap-2 text-muted hover:text-red-400">
              <Trash2 className="h-4 w-4" /> Limpiar
            </Button>
          ) : null
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 pb-4">
        {/* Model Selector */}
        <div className="relative">
          <button
            onClick={() => setSelectorOpen(!selectorOpen)}
            className={`flex w-full items-center gap-3 rounded-2xl border p-3 transition-all duration-300 ${modelColorMap[activeColor]} backdrop-blur-sm`}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-current/20 bg-current/10">
              <activeModel.icon className="h-5 w-5" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-black tracking-tight">{activeModel.label}</p>
              <p className="text-xs opacity-70">{activeModel.desc}</p>
            </div>
            <span className="rounded-full border border-current/30 bg-current/10 px-2.5 py-0.5 text-[10px] font-black tracking-widest">
              {activeModel.badge}
            </span>
            <ChevronDown className={`h-4 w-4 opacity-60 transition-transform ${selectorOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {selectorOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#0d1012]/95 backdrop-blur-2xl shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
              >
                {MODELS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => { setModel(m.value); setSelectorOpen(false); }}
                    className={`flex w-full items-center gap-3 px-4 py-3 transition-all hover:bg-white/[0.04] ${model === m.value ? 'bg-white/[0.06]' : ''}`}
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${modelColorMap[m.color]}`}>
                      <m.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-bold text-foreground">{m.label}</p>
                      <p className="text-xs text-muted">{m.desc}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black tracking-widest ${modelColorMap[m.color]}`}>{m.badge}</span>
                    {model === m.value && <div className="h-2 w-2 rounded-full bg-current" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Messages */}
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0c0b]/70 backdrop-blur-sm">
          <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(to_right,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:32px_32px]" />

          <div className="h-full overflow-y-auto scroll-smooth px-4 py-4">
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex h-full flex-col items-center justify-center gap-5 text-center"
              >
                <div className={`relative flex h-20 w-20 items-center justify-center rounded-3xl border ${modelColorMap[activeColor]}`}>
                  <activeModel.icon className="h-10 w-10" />
                  <motion.div
                    className="absolute inset-0 rounded-3xl border border-current opacity-30"
                    animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0, 0.3] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: 'easeOut' }}
                  />
                </div>
                <div>
                  <p className="text-lg font-black text-foreground">{activeModel.label} listo</p>
                  <p className="mt-1 text-sm text-muted">{activeModel.desc} · Escribe para comenzar</p>
                </div>
                <div className="grid max-w-sm grid-cols-1 gap-2 text-left sm:grid-cols-2">
                  {['¿Qué es un webhook?', 'Escribe un script en Python', 'Explica el bot', 'Analiza este código'].map((s) => (
                    <button
                      key={s}
                      onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                      className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs text-muted transition-all hover:border-white/20 hover:bg-white/[0.07] hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            <div className="space-y-4">
              <AnimatePresence initial={false}>
                {messages.map((msg) => {
                  const msgModel = MODELS.find(m => m.value === msg.model) || activeModel;
                  const msgColor = msgModel.color;
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 14, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className={`group flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      {/* Avatar */}
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                        msg.role === 'user'
                          ? 'border-white/15 bg-white/[0.07]'
                          : `${modelColorMap[msgColor]}`
                      }`}>
                        {msg.role === 'user'
                          ? <User className="h-5 w-5 text-muted" />
                          : <msgModel.icon className="h-5 w-5" />}
                      </div>

                      {/* Bubble */}
                      <div className={`group relative max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                        <div className={`relative rounded-2xl border px-4 py-3 backdrop-blur-sm ${
                          msg.role === 'user'
                            ? 'rounded-tr-sm border-white/15 bg-white/[0.07]'
                            : `rounded-tl-sm ${modelBubbleMap[msgColor]}`
                        }`}>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{msg.content}</p>
                          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <CopyButton text={msg.content} />
                          </div>
                        </div>
                        <span className="px-1 text-[10px] text-muted">
                          {msg.timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          {msg.role === 'assistant' && ` · ${msgModel.label}`}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${modelColorMap[activeColor]}`}>
                    <activeModel.icon className="h-5 w-5" />
                  </div>
                  <TypingIndicator color={activeColor} />
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* Input */}
        <div className={`relative overflow-hidden rounded-2xl border bg-[#0d1012]/80 backdrop-blur-sm transition-all duration-300 ${
          modelColorMap[activeColor].replace('text-', 'focus-within:border-').split(' ')[0]
        } border-white/15 focus-within:shadow-[0_0_0_1px_rgba(var(--page-a),0.2)]`}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize(); }}
            onKeyDown={handleKeyDown}
            placeholder={`Mensaje para ${activeModel.label}... (Enter para enviar, Shift+Enter nueva línea)`}
            rows={1}
            disabled={isLoading}
            className="w-full resize-none bg-transparent px-4 py-3.5 pr-14 text-sm text-foreground placeholder:text-muted focus:outline-none disabled:opacity-50"
            style={{ minHeight: '52px', maxHeight: '160px' }}
          />

          <div className="absolute bottom-2 right-2">
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
                input.trim() && !isLoading
                  ? `${modelColorMap[activeColor]} scale-100`
                  : 'border-white/10 bg-white/[0.04] text-muted'
              }`}
            >
              {isLoading
                ? <RefreshCw className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
