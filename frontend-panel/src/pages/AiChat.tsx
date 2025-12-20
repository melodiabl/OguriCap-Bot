import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  User,
  Send,
  Settings,
  History,
  Trash2,
  Copy,
  Brain,
  Plus,
  Loader2,
  X,
  Save,
  MessageSquare
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { apiService } from '../services/api';
import { AnimatedCard, StatCard } from '../components/ui/AnimatedCard';
import { AnimatedButton, IconButton } from '../components/ui/AnimatedButton';
import dayjs from 'dayjs';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  tokens_used?: number;
  model?: string;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  last_message: string;
  message_count: number;
}

export const AiChat: React.FC = () => {
  const [currentMessage, setCurrentMessage] = useState('');
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: messages, isLoading: messagesLoading } = useQuery(
    ['chatMessages', selectedSession],
    () => apiService.getChatMessages(selectedSession || ''),
    { enabled: !!selectedSession, refetchInterval: 1000 }
  );

  const { data: sessions, isLoading: sessionsLoading } = useQuery('chatSessions', apiService.getChatSessions);
  const { data: aiStats } = useQuery('aiStats', apiService.getAiStats);

  const sendMessageMutation = useMutation(
    (message: string) => apiService.sendChatMessage(selectedSession || '', message),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['chatMessages', selectedSession]);
        queryClient.invalidateQueries('chatSessions');
        setCurrentMessage('');
        setIsTyping(false);
      },
      onError: () => setIsTyping(false),
    }
  );

  const createSessionMutation = useMutation(
    (title: string) => apiService.createChatSession(title),
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries('chatSessions');
        setSelectedSession(data.id);
      },
    }
  );

  const deleteSessionMutation = useMutation(
    (sessionId: string) => apiService.deleteChatSession(sessionId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('chatSessions');
        if (selectedSession) setSelectedSession(null);
      },
    }
  );

  const handleSendMessage = () => {
    if (!currentMessage.trim() || !selectedSession) return;
    setIsTyping(true);
    sendMessageMutation.mutate(currentMessage);
  };

  const handleCreateSession = () => {
    const title = `Chat ${dayjs().format('DD/MM/YYYY HH:mm')}`;
    createSessionMutation.mutate(title);
  };

  const handleDeleteSession = (sessionId: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta sesión?')) {
      deleteSessionMutation.mutate(sessionId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const chatMessages = messages || [];
  const chatSessions = sessions || [];

  if (messagesLoading || sessionsLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary-400" />
          <h2 className="text-xl font-semibold text-white">Cargando chat AI...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-violet-500/20 rounded-xl">
                <Brain className="w-8 h-8 text-violet-400" />
              </div>
              AI Chat
            </h1>
            <p className="text-gray-400 mt-2">Conversa con la inteligencia artificial del bot</p>
          </div>
          <div className="flex items-center gap-3">
            <AnimatedButton
              onClick={() => setIsHistoryOpen(true)}
              variant="secondary"
              icon={<History className="w-4 h-4" />}
            >
              Historial
            </AnimatedButton>
            <AnimatedButton
              onClick={() => setIsSettingsOpen(true)}
              variant="secondary"
              icon={<Settings className="w-4 h-4" />}
            >
              Configuración
            </AnimatedButton>
            <AnimatedButton
              onClick={handleCreateSession}
              loading={createSessionMutation.isLoading}
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
            >
              Nueva Sesión
            </AnimatedButton>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Sesiones Activas"
            value={chatSessions.length}
            icon={<Brain className="w-6 h-6" />}
            color="violet"
            delay={0}
          />
          <StatCard
            title="Mensajes Enviados"
            value={aiStats?.totalMessages || 0}
            icon={<Send className="w-6 h-6" />}
            color="info"
            delay={0.1}
          />
          <StatCard
            title="Tokens Usados"
            value={aiStats?.totalTokens || 0}
            icon={<Settings className="w-6 h-6" />}
            color="success"
            delay={0.2}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sessions List */}
          <AnimatedCard delay={0.2} className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Sesiones de Chat</h3>
            {chatSessions.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No hay sesiones de chat</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {chatSessions.map((session: ChatSession) => (
                  <motion.div
                    key={session.id}
                    whileHover={{ scale: 1.02 }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedSession === session.id
                        ? 'bg-violet-500/20 border-violet-500/50'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                    onClick={() => setSelectedSession(session.id)}
                  >
                    <h4 className="font-semibold text-sm text-white truncate">{session.title}</h4>
                    <p className="text-xs text-gray-500">{session.message_count} mensajes</p>
                    <p className="text-xs text-gray-600">{dayjs(session.last_message).format('DD/MM HH:mm')}</p>
                    <div className="flex justify-end mt-2">
                      <IconButton
                        icon={<Trash2 className="w-3 h-3" />}
                        onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                        variant="ghost"
                        size="sm"
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatedCard>

          {/* Chat Area */}
          <AnimatedCard delay={0.3} className="lg:col-span-3 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              {selectedSession ? `Sesión: ${chatSessions.find((s: ChatSession) => s.id === selectedSession)?.title}` : 'Selecciona una sesión'}
            </h3>

            {!selectedSession ? (
              <div className="text-center py-16">
                <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">Selecciona una sesión de chat para comenzar</p>
              </div>
            ) : (
              <div className="space-y-4 h-96 flex flex-col">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 bg-white/5 rounded-xl space-y-4">
                  {chatMessages.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No hay mensajes en esta sesión</p>
                    </div>
                  ) : (
                    chatMessages.map((message: ChatMessage) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                          message.role === 'user'
                            ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white'
                            : 'bg-white/10 text-white border border-white/10'
                        }`}>
                          <div className="flex items-start gap-2">
                            <div className={`p-1 rounded-full ${message.role === 'user' ? 'bg-white/20' : 'bg-violet-500/20'}`}>
                              {message.role === 'user' ? (
                                <User className="w-4 h-4" />
                              ) : (
                                <Bot className="w-4 h-4 text-violet-400" />
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                              <div className="flex items-center justify-between mt-2 text-xs opacity-70">
                                <span>{dayjs(message.timestamp).format('HH:mm')}</span>
                                {message.tokens_used && <span>{message.tokens_used} tokens</span>}
                              </div>
                            </div>
                            <IconButton
                              icon={<Copy className="w-3 h-3" />}
                              onClick={() => copyToClipboard(message.content)}
                              variant="ghost"
                              size="sm"
                            />
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-white/10 border border-white/10 px-4 py-3 rounded-2xl">
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded-full bg-violet-500/20">
                            <Bot className="w-4 h-4 text-violet-400" />
                          </div>
                          <span className="text-sm text-gray-400">AI está escribiendo</span>
                          <Loader2 className="w-3 h-3 animate-spin text-violet-400" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="flex items-end gap-3">
                  <textarea
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe tu mensaje aquí..."
                    rows={2}
                    className="flex-1 p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-violet-500/50 resize-none transition-all"
                  />
                  <AnimatedButton
                    onClick={handleSendMessage}
                    disabled={!currentMessage.trim()}
                    loading={sendMessageMutation.isLoading}
                    variant="primary"
                    icon={<Send className="w-4 h-4" />}
                  >
                    Enviar
                  </AnimatedButton>
                </div>
              </div>
            )}
          </AnimatedCard>
        </div>

        {/* Settings Modal */}
        <AnimatePresence>
          {isSettingsOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setIsSettingsOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="glass-card p-6 w-full max-w-md"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-white">Configuración de AI Chat</h3>
                  <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Modelo de IA</label>
                    <select className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-violet-500/50 transition-all">
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      <option value="gpt-4">GPT-4</option>
                      <option value="claude-3">Claude 3</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Temperatura</label>
                    <input
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      defaultValue="0.7"
                      className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-violet-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Máximo de tokens</label>
                    <input
                      type="number"
                      defaultValue="1000"
                      className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-violet-500/50 transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <AnimatedButton onClick={() => setIsSettingsOpen(false)} variant="secondary" fullWidth>
                    Cancelar
                  </AnimatedButton>
                  <AnimatedButton onClick={() => setIsSettingsOpen(false)} variant="primary" fullWidth icon={<Save className="w-4 h-4" />}>
                    Guardar
                  </AnimatedButton>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* History Modal */}
        <AnimatePresence>
          {isHistoryOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setIsHistoryOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="glass-card p-6 w-full max-w-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-white">Historial de Conversaciones</h3>
                  <button onClick={() => setIsHistoryOpen(false)} className="text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {chatSessions.map((session: ChatSession) => (
                    <motion.div
                      key={session.id}
                      whileHover={{ scale: 1.01 }}
                      className="p-4 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:border-violet-500/30 transition-all"
                      onClick={() => { setSelectedSession(session.id); setIsHistoryOpen(false); }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-white">{session.title}</h4>
                          <p className="text-sm text-gray-500">
                            {session.message_count} mensajes • {dayjs(session.created_at).format('DD/MM/YYYY HH:mm')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 text-xs font-medium text-violet-400 bg-violet-500/20 rounded-full">
                            {session.message_count}
                          </span>
                          <IconButton
                            icon={<Trash2 className="w-4 h-4" />}
                            onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                            variant="danger"
                            size="sm"
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="flex justify-end mt-6">
                  <AnimatedButton onClick={() => setIsHistoryOpen(false)} variant="secondary">
                    Cerrar
                  </AnimatedButton>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AiChat;
