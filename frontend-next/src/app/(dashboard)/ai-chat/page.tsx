'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, Send, User, Sparkles, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SimpleSelect } from '@/components/ui/Select';
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-3xl font-bold text-white">AI Chat</h1>
          <p className="text-gray-400 mt-1">Conversa con la inteligencia artificial</p>
        </motion.div>
        <div className="flex items-center gap-3">
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
        </div>
      </div>

      <Card animated className="flex-1 flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-primary-500/20 flex items-center justify-center mb-4">
                <Sparkles className="w-10 h-10 text-primary-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">¡Hola! Soy tu asistente AI</h3>
              <p className="text-gray-400 max-w-md">
                Puedo ayudarte con preguntas sobre el bot, comandos, o cualquier otra cosa.
              </p>
            </div>
          ) : (
            messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary-400" />
                  </div>
                )}
                <div className={`max-w-[70%] p-4 rounded-2xl ${
                  message.role === 'user'
                    ? 'bg-primary-500 text-white rounded-br-sm'
                    : 'bg-white/5 text-gray-200 rounded-bl-sm'
                }`}>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <p className={`text-xs mt-2 ${message.role === 'user' ? 'text-primary-200' : 'text-gray-500'}`}>
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-emerald-400" />
                  </div>
                )}
              </motion.div>
            ))
          )}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary-400" />
              </div>
              <div className="bg-white/5 p-4 rounded-2xl rounded-bl-sm">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/10">
          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
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
    </div>
  );
}
