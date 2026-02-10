'use client';

import React, { useState, useEffect } from 'react';
import { Send, Users, MessageSquare, Globe, AlertCircle, CheckCircle2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import api from '@/services/api';
import toast from 'react-hot-toast';

interface Group {
  wa_jid: string;
  nombre: string;
  participantes?: number;
  tipo?: 'group' | 'channel' | 'community';
}

export const BroadcastTool: React.FC = () => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    groups: true,
    channels: true,
    communities: true
  });
  const [selectedJids, setSelectedJids] = useState<Set<string>>(new Set());
  const [targets, setTargets] = useState({
    groups: true,
    channels: true,
    communities: true
  });

  // Cargar grupos al montar el componente
  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    setLoadingGroups(true);
    try {
      const res = await api.getGroups(1, 1000);
      if (res.items) {
        setGroups(res.items);
        // Seleccionar todos por defecto
        const allJids = new Set(res.items.map((g: Group) => g.wa_jid));
        setSelectedJids(allJids);
      }
    } catch (error) {
      console.error('Error cargando grupos:', error);
      toast.error('Error al cargar los grupos');
    } finally {
      setLoadingGroups(false);
    }
  };

  const detectChatType = (jid: string): 'group' | 'channel' | 'community' => {
    if (jid.includes('@newsletter')) return 'community';
    if (jid.includes('@broadcast')) return 'channel';
    return 'group';
  };

  const toggleJid = (jid: string) => {
    const newSelected = new Set(selectedJids);
    if (newSelected.has(jid)) {
      newSelected.delete(jid);
    } else {
      newSelected.add(jid);
    }
    setSelectedJids(newSelected);
  };

  const toggleSection = (section: 'groups' | 'channels' | 'communities') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getFilteredGroups = (type: 'group' | 'channel' | 'community') => {
    return groups.filter(g => detectChatType(g.wa_jid) === type);
  };

  const selectAllOfType = (type: 'group' | 'channel' | 'community') => {
    const filtered = getFilteredGroups(type);
    const newSelected = new Set(selectedJids);
    filtered.forEach(g => newSelected.add(g.wa_jid));
    setSelectedJids(newSelected);
  };

  const deselectAllOfType = (type: 'group' | 'channel' | 'community') => {
    const filtered = getFilteredGroups(type);
    const newSelected = new Set(selectedJids);
    filtered.forEach(g => newSelected.delete(g.wa_jid));
    setSelectedJids(newSelected);
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Por favor, escribe un mensaje');
      return;
    }

    if (selectedJids.size === 0) {
      toast.error('Selecciona al menos un grupo, canal o comunidad');
      return;
    }

    setIsSending(true);
    try {
      const res = await api.sendBroadcast({
        message,
        targets: {
          groups: false,
          channels: false,
          communities: false,
          specific: Array.from(selectedJids)
        }
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
        {/* Destinos - Selecciona a dónde enviar */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-300">
            Selecciona los destinos para el mensaje:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => setTargets(prev => ({ ...prev, groups: !prev.groups }))}
              className={`flex items-center justify-center gap-2 p-4 rounded-xl border transition-all ${
                targets.groups 
                  ? 'bg-primary-500/20 border-primary-500/50 text-primary-200 shadow-lg shadow-primary-500/20' 
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              <Users className="w-5 h-5" />
              <div className="text-left">
                <span className="text-sm font-medium block">Grupos</span>
                <span className="text-xs opacity-75">{targets.groups ? '✓ Activado' : 'Desactivado'}</span>
              </div>
            </button>

            <button
              onClick={() => setTargets(prev => ({ ...prev, channels: !prev.channels }))}
              className={`flex items-center justify-center gap-2 p-4 rounded-xl border transition-all ${
                targets.channels 
                  ? 'bg-primary-500/20 border-primary-500/50 text-primary-200 shadow-lg shadow-primary-500/20' 
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              <div className="text-left">
                <span className="text-sm font-medium block">Canales</span>
                <span className="text-xs opacity-75">{targets.channels ? '✓ Activado' : 'Desactivado'}</span>
              </div>
            </button>

            <button
              onClick={() => setTargets(prev => ({ ...prev, communities: !prev.communities }))}
              className={`flex items-center justify-center gap-2 p-4 rounded-xl border transition-all ${
                targets.communities 
                  ? 'bg-primary-500/20 border-primary-500/50 text-primary-200 shadow-lg shadow-primary-500/20' 
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              <Globe className="w-5 h-5" />
              <div className="text-left">
                <span className="text-sm font-medium block">Comunidades</span>
                <span className="text-xs opacity-75">{targets.communities ? '✓ Activado' : 'Desactivado'}</span>
              </div>
            </button>
          </div>
        </div>

        {/* Lista de Grupos, Canales y Comunidades */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-300">
              Selecciona específicamente a dónde enviar:
            </label>
            {loadingGroups && <span className="text-xs text-gray-400">Cargando...</span>}
          </div>

          {/* Grupos */}
          {getFilteredGroups('group').length > 0 && (
            <div className="rounded-xl border border-primary-500/20 bg-primary-500/5 overflow-hidden">
              <button
                onClick={() => toggleSection('groups')}
                className="w-full flex items-center justify-between p-4 hover:bg-primary-500/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary-400" />
                  <span className="text-sm font-medium text-primary-200">
                    Grupos ({getFilteredGroups('group').filter(g => selectedJids.has(g.wa_jid)).length}/{getFilteredGroups('group').length})
                  </span>
                </div>
                {expandedSections.groups ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              {expandedSections.groups && (
                <div className="border-t border-primary-500/20 p-3 space-y-2 max-h-48 overflow-y-auto">
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => selectAllOfType('group')}
                      className="text-xs px-2 py-1 rounded bg-primary-500/20 text-primary-200 hover:bg-primary-500/30"
                    >
                      Seleccionar todos
                    </button>
                    <button
                      onClick={() => deselectAllOfType('group')}
                      className="text-xs px-2 py-1 rounded bg-primary-500/10 text-primary-300 hover:bg-primary-500/20"
                    >
                      Deseleccionar todos
                    </button>
                  </div>
                  {getFilteredGroups('group').map(group => (
                    <label key={group.wa_jid} className="flex items-center gap-2 p-2 rounded hover:bg-primary-500/10 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedJids.has(group.wa_jid)}
                        onChange={() => toggleJid(group.wa_jid)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm text-gray-300 flex-1">{group.nombre}</span>
                      {group.participantes && (
                        <span className="text-xs text-gray-500">{group.participantes} miembros</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Canales */}
          {getFilteredGroups('channel').length > 0 && (
            <div className="rounded-xl border border-primary-500/20 bg-primary-500/5 overflow-hidden">
              <button
                onClick={() => toggleSection('channels')}
                className="w-full flex items-center justify-between p-4 hover:bg-primary-500/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary-400" />
                  <span className="text-sm font-medium text-primary-200">
                    Canales ({getFilteredGroups('channel').filter(g => selectedJids.has(g.wa_jid)).length}/{getFilteredGroups('channel').length})
                  </span>
                </div>
                {expandedSections.channels ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              {expandedSections.channels && (
                <div className="border-t border-primary-500/20 p-3 space-y-2 max-h-48 overflow-y-auto">
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => selectAllOfType('channel')}
                      className="text-xs px-2 py-1 rounded bg-primary-500/20 text-primary-200 hover:bg-primary-500/30"
                    >
                      Seleccionar todos
                    </button>
                    <button
                      onClick={() => deselectAllOfType('channel')}
                      className="text-xs px-2 py-1 rounded bg-primary-500/10 text-primary-300 hover:bg-primary-500/20"
                    >
                      Deseleccionar todos
                    </button>
                  </div>
                  {getFilteredGroups('channel').map(group => (
                    <label key={group.wa_jid} className="flex items-center gap-2 p-2 rounded hover:bg-primary-500/10 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedJids.has(group.wa_jid)}
                        onChange={() => toggleJid(group.wa_jid)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm text-gray-300 flex-1">{group.nombre}</span>
                      {group.participantes && (
                        <span className="text-xs text-gray-500">{group.participantes} miembros</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Comunidades */}
          {getFilteredGroups('community').length > 0 && (
            <div className="rounded-xl border border-primary-500/20 bg-primary-500/5 overflow-hidden">
              <button
                onClick={() => toggleSection('communities')}
                className="w-full flex items-center justify-between p-4 hover:bg-primary-500/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary-400" />
                  <span className="text-sm font-medium text-primary-200">
                    Comunidades ({getFilteredGroups('community').filter(g => selectedJids.has(g.wa_jid)).length}/{getFilteredGroups('community').length})
                  </span>
                </div>
                {expandedSections.communities ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              {expandedSections.communities && (
                <div className="border-t border-primary-500/20 p-3 space-y-2 max-h-48 overflow-y-auto">
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => selectAllOfType('community')}
                      className="text-xs px-2 py-1 rounded bg-primary-500/20 text-primary-200 hover:bg-primary-500/30"
                    >
                      Seleccionar todos
                    </button>
                    <button
                      onClick={() => deselectAllOfType('community')}
                      className="text-xs px-2 py-1 rounded bg-primary-500/10 text-primary-300 hover:bg-primary-500/20"
                    >
                      Deseleccionar todos
                    </button>
                  </div>
                  {getFilteredGroups('community').map(group => (
                    <label key={group.wa_jid} className="flex items-center gap-2 p-2 rounded hover:bg-primary-500/10 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedJids.has(group.wa_jid)}
                        onChange={() => toggleJid(group.wa_jid)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm text-gray-300 flex-1">{group.nombre}</span>
                      {group.participantes && (
                        <span className="text-xs text-gray-500">{group.participantes} miembros</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {groups.length === 0 && !loadingGroups && (
            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 text-sm">
              No hay grupos, canales o comunidades disponibles
            </div>
          )}
        </div>

        {/* Resumen de destinos seleccionados */}
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
          <p className="text-sm font-medium text-green-200 mb-2">📍 Total seleccionados: {selectedJids.size}</p>
          <div className="text-xs text-green-300">
            {selectedJids.size === 0 ? (
              <span>⚠️ Ningún destino seleccionado</span>
            ) : (
              <span>✓ Listos para enviar a {selectedJids.size} destino{selectedJids.size !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>

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
