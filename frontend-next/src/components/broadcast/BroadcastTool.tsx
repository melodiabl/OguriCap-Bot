'use client';

import React, { useState } from 'react';
import { Send, Users, MessageSquare, Globe, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import api from '@/services/api';
import toast from 'react-hot-toast';

export const BroadcastTool: React.FC = () => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [targets, setTargets] = useState({
    groups: false,
    channels: false,
    communities: false
  });
  const [sendToAll, setSendToAll] = useState(true);

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Por favor, escribe un mensaje');
      return;
    }

    // Si sendToAll está activado, no validar targets
    if (!sendToAll && !targets.groups && !targets.channels && !targets.communities) {
      toast.error('Selecciona al menos un destino o activa "Enviar a todos"');
      return;
    }

    setIsSending(true);
    try {
      const res = await api.sendBroadcast({
        message,
        targets: sendToAll ? { groups: false, channels: false, communities: false } : targets
      });
      
      if (res.success) {
        const targetInfo = res.stats 
          ? `Grupos: ${res.stats.groups}, Canales: ${res.stats.channels}, Comunidades: ${res.stats.communities}`
          : `aprox. ${res.estimatedTargets} destinatarios`;
        toast.success(`Envío masivo iniciado para ${targetInfo}`);
        setMessage('');
      }
    } catch (error: any) {
      console.error('Error en broadcast:', error);
      toast.error(error.response?.data?.error || 'Error al iniciar el envío masivo');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card className="p-6 border border-white/10 bg-white/5 overflow-hidden relative">
      <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
        <Globe className="w-32 h-32 text-primary-500" />
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-2xl bg-primary-500/20 border border-primary-500/20">
          <Send className="w-5 h-5 text-primary-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Mensaje Global Masivo</h3>
          <p className="text-sm text-gray-400">Envía avisos a múltiples grupos y comunidades simultáneamente.</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Opción de Enviar a Todos */}
        <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <input
            type="checkbox"
            checked={sendToAll}
            onChange={(e) => setSendToAll(e.target.checked)}
            className="w-4 h-4 rounded cursor-pointer"
          />
          <label className="flex-1 cursor-pointer">
            <p className="text-sm font-medium text-blue-200">Enviar a todos los grupos, canales y comunidades</p>
            <p className="text-xs text-blue-300/70">Desactiva esto para seleccionar destinos específicos</p>
          </label>
        </div>

        {/* Destinos (solo si no es enviar a todos) */}
        {!sendToAll && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => setTargets(prev => ({ ...prev, groups: !prev.groups }))}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                targets.groups 
                  ? 'bg-primary-500/20 border-primary-500/50 text-primary-200' 
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">Grupos</span>
            </button>

            <button
              onClick={() => setTargets(prev => ({ ...prev, channels: !prev.channels }))}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                targets.channels 
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200' 
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-sm font-medium">Canales</span>
            </button>

            <button
              onClick={() => setTargets(prev => ({ ...prev, communities: !prev.communities }))}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                targets.communities 
                  ? 'bg-violet-500/20 border-violet-500/50 text-violet-200' 
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span className="text-sm font-medium">Comunidades</span>
            </button>
          </div>
        )}

        {/* Mensaje */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
            Contenido del Mensaje
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500 border border-white/10">Soporta Markdown</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escribe el aviso global aquí..."
            className="w-full h-32 p-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all resize-none"
          />
        </div>

        {/* Advertencia */}
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-200/80 leading-relaxed">
            <strong>Nota de seguridad:</strong> Los mensajes se envían con un intervalo de 1.5 segundos para evitar que WhatsApp detecte spam y bloquee el número del bot. El proceso se ejecuta en segundo plano.
          </p>
        </div>

        {/* Botón de Envío */}
        <Button
          onClick={handleSend}
          disabled={isSending || !message.trim()}
          className="w-full py-6 rounded-xl text-base font-bold shadow-lg shadow-primary-500/20"
        >
          {isSending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Iniciando Envío...
            </>
          ) : (
            <>
              <Send className="w-5 h-5 mr-2" />
              Enviar Mensaje Global
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};
