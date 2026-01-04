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

  return (
    <div className="min-h-full flex flex-col min-h-0">
      <PageHeader
        title="AI Chat"
        description="Conversa con la inteligencia artificial"
        icon={<Sparkles className="w-5 h-5 text-primary" />}
        actions={
          <>
            <div className="w-52">
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
                <div className={`max-w-[70%] p-4 rounded-2xl ${
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
