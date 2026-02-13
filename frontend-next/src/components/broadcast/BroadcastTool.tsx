'use client';

import React, { useState, useEffect } from 'react';
import { Send, Users, MessageSquare, Globe, AlertCircle, CheckCircle2, Loader2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import api from '@/services/api';
import toast from 'react-hot-toast';

interface Group {
  wa_jid: string;
  nombre: string;
  participantes?: number;
  tipo?: 'group' | 'channel' | 'community';
  isCommunity?: boolean;
  isChannel?: boolean;
}

export const BroadcastTool: React.FC = () => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    groups: false,
    channels: false,
    communities: false
  });
  const [selectedJids, setSelectedJids] = useState<Set<string>>(new Set<string>());
  const [targets, setTargets] = useState({
    groups: false,
    channels: false,
    communities: false
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
      }
    } catch (error) {
      console.error('Error cargando grupos:', error);
      toast.error('Error al cargar los grupos');
    } finally {
      setLoadingGroups(false);
    }
  };

  const detectChatType = (group: Group): 'group' | 'channel' | 'community' => {
    // Usar metadata de la DB si está disponible
    if (group.tipo) return group.tipo;
    
    // Fallback a detección por JID
    const jid = group.wa_jid;
    if (jid.includes('@newsletter')) return 'channel';
    if (jid.includes('@broadcast')) return 'channel';
    return 'group';
  };

  const toggleTargetCategory = (type: 'groups' | 'channels' | 'communities') => {
    const isNowActive = !targets[type];
    setTargets(prev => ({ ...prev, [type]: isNowActive }));
    
    // Al activar una categoría, expandir su sección automáticamente
    if (isNowActive) {
      setExpandedSections(prev => ({ ...prev, [type]: true }));
    } else {
      // Al desactivar, colapsar y deseleccionar todos
      setExpandedSections(prev => ({ ...prev, [type]: false }));
      const categoryType = type === 'groups' ? 'group' : type === 'channels' ? 'channel' : 'community';
      deselectAllOfType(categoryType as any);
    }
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
    return groups.filter(g => detectChatType(g) === type);
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

    if (selectedJids.size === 0 && !targets.groups && !targets.channels && !targets.communities) {
      toast.error('Selecciona al menos un grupo, canal o comunidad');
      return;
    }

    setIsSending(true);
    try {
      const res = await api.sendBroadcast({
        message,
        targets: {
          groups: targets.groups,
          channels: targets.channels,
          communities: targets.communities,
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

  // Función para obtener el color temático según el tipo
  const getCategoryTheme = (type: 'groups' | 'channels' | 'communities') => {
    const themes = {
      groups: {
        active: 'bg-oguri-purple/20 border-oguri-purple/50 text-oguri-lavender shadow-glow-oguri-purple',
        inactive: 'bg-oguri-phantom-700/20 border-oguri-phantom-600/30 text-gray-400 hover:bg-oguri-phantom-600/30 hover:border-oguri-purple/30',
        icon: 'text-oguri-purple',
        glow: 'shadow-glow-oguri-purple',
        gradient: 'from-oguri-purple to-oguri-lavender',
      },
      channels: {
        active: 'bg-oguri-blue/20 border-oguri-blue/50 text-blue-200 shadow-glow-oguri-blue',
        inactive: 'bg-oguri-phantom-700/20 border-oguri-phantom-600/30 text-gray-400 hover:bg-oguri-phantom-600/30 hover:border-oguri-blue/30',
        icon: 'text-oguri-blue',
        glow: 'shadow-glow-oguri-blue',
        gradient: 'from-oguri-blue to-oguri-cyan',
      },
      communities: {
        active: 'bg-oguri-cyan/20 border-oguri-cyan/50 text-cyan-200 shadow-glow-oguri-cyan',
        inactive: 'bg-oguri-phantom-700/20 border-oguri-phantom-600/30 text-gray-400 hover:bg-oguri-phantom-600/30 hover:border-oguri-cyan/30',
        icon: 'text-oguri-cyan',
        glow: 'shadow-glow-oguri-cyan',
        gradient: 'from-oguri-cyan to-oguri-blue',
      },
    };
    return themes[type];
  };

  return (
    <Card className="p-6 border border-white/10 bg-gradient-to-br from-oguri-phantom-900/40 via-oguri-phantom-800/30 to-oguri-phantom-900/40 overflow-hidden relative backdrop-blur-xl animate-fade-in-up">
      {/* Decoración de fondo con efecto Oguri */}
      <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none animate-float">
        <Sparkles className="w-32 h-32 text-oguri-lavender" />
      </div>
      <div className="absolute bottom-0 left-0 p-8 opacity-5 pointer-events-none">
        <Globe className="w-40 h-40 text-oguri-blue" />
      </div>

      {/* Header con gradiente Oguri */}
      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="p-2.5 rounded-2xl bg-gradient-to-br from-oguri-purple to-oguri-lavender shadow-glow-oguri-mixed animate-pulse-glow-oguri">
          <Send className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            Mensaje Global Masivo
            <span className="text-xs px-2 py-0.5 rounded-full bg-oguri-gold/20 text-oguri-gold border border-oguri-gold/30 animate-shimmer-oguri">
              Oguri Power
            </span>
          </h3>
          <p className="text-sm text-gray-400">Envía avisos a múltiples grupos y comunidades simultáneamente.</p>
        </div>
      </div>

      <div className="space-y-6 relative z-10">
        {/* Destinos - Selecciona a dónde enviar */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-oguri-lavender" />
            Selecciona los destinos para el mensaje:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Grupos */}
            <button
              onClick={() => toggleTargetCategory('groups')}
              className={`flex items-center justify-center gap-2 p-4 rounded-xl border transition-all duration-300 transform hover:scale-105 ${
                targets.groups 
                  ? getCategoryTheme('groups').active + ' animate-glow-expand'
                  : getCategoryTheme('groups').inactive
              }`}
            >
              <Users className={`w-5 h-5 ${targets.groups ? 'text-oguri-lavender' : 'text-gray-500'}`} />
              <div className="text-left">
                <span className="text-sm font-medium block">Grupos</span>
                <span className="text-xs opacity-75">{targets.groups ? '✓ Activado' : 'Desactivado'}</span>
              </div>
            </button>

            {/* Canales */}
            <button
              onClick={() => toggleTargetCategory('channels')}
              className={`flex items-center justify-center gap-2 p-4 rounded-xl border transition-all duration-300 transform hover:scale-105 ${
                targets.channels 
                  ? getCategoryTheme('channels').active + ' animate-glow-expand'
                  : getCategoryTheme('channels').inactive
              }`}
            >
              <MessageSquare className={`w-5 h-5 ${targets.channels ? 'text-blue-300' : 'text-gray-500'}`} />
              <div className="text-left">
                <span className="text-sm font-medium block">Canales</span>
                <span className="text-xs opacity-75">{targets.channels ? '✓ Activado' : 'Desactivado'}</span>
              </div>
            </button>

            {/* Comunidades */}
            <button
              onClick={() => toggleTargetCategory('communities')}
              className={`flex items-center justify-center gap-2 p-4 rounded-xl border transition-all duration-300 transform hover:scale-105 ${
                targets.communities 
                  ? getCategoryTheme('communities').active + ' animate-glow-expand'
                  : getCategoryTheme('communities').inactive
              }`}
            >
              <Globe className={`w-5 h-5 ${targets.communities ? 'text-cyan-300' : 'text-gray-500'}`} />
              <div className="text-left">
                <span className="text-sm font-medium block">Comunidades</span>
                <span className="text-xs opacity-75">{targets.communities ? '✓ Activado' : 'Desactivado'}</span>
              </div>
            </button>
          </div>
        </div>

        {/* Lista de Grupos, Canales y Comunidades - Solo se muestra si está activado */}
        {(targets.groups || targets.channels || targets.communities) && (
          <div className="space-y-3 animate-slide-down">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-oguri-lavender" />
                Selecciona específicamente a dónde enviar:
              </label>
              {loadingGroups && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Cargando...
                </span>
              )}
            </div>

            {/* Grupos - Solo visible si está activado */}
            {targets.groups && getFilteredGroups('group').length > 0 && (
              <div className="rounded-xl border border-oguri-purple/30 bg-gradient-to-br from-oguri-purple/10 to-oguri-lavender/5 overflow-hidden animate-slide-up backdrop-blur-sm">
                <button
                  onClick={() => toggleSection('groups')}
                  className="w-full flex items-center justify-between p-4 hover:bg-oguri-purple/15 transition-all duration-300"
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-oguri-lavender" />
                    <span className="text-sm font-medium text-oguri-lavender">
                      Grupos ({getFilteredGroups('group').filter(g => selectedJids.has(g.wa_jid)).length}/{getFilteredGroups('group').length})
                    </span>
                  </div>
                  {expandedSections.groups ? (
                    <ChevronUp className="w-4 h-4 text-oguri-lavender" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-oguri-lavender" />
                  )}
                </button>
                {expandedSections.groups && (
                  <div className="border-t border-oguri-purple/20 p-3 space-y-2 max-h-48 overflow-y-auto animate-slide-down">
                    <div className="flex gap-2 mb-2">
                      <button
                        onClick={() => selectAllOfType('group')}
                        className="text-xs px-3 py-1.5 rounded-lg bg-oguri-purple/30 text-oguri-lavender hover:bg-oguri-purple/40 transition-all duration-200 border border-oguri-purple/30"
                      >
                        Seleccionar todos
                      </button>
                      <button
                        onClick={() => deselectAllOfType('group')}
                        className="text-xs px-3 py-1.5 rounded-lg bg-oguri-phantom-700/30 text-gray-300 hover:bg-oguri-phantom-600/40 transition-all duration-200 border border-oguri-phantom-600/30"
                      >
                        Deseleccionar todos
                      </button>
                    </div>
                    {getFilteredGroups('group').map(group => (
                      <label key={group.wa_jid} className="flex items-center gap-2 p-2 rounded-lg hover:bg-oguri-purple/15 cursor-pointer transition-all duration-200 group">
                        <input
                          type="checkbox"
                          checked={selectedJids.has(group.wa_jid)}
                          onChange={() => toggleJid(group.wa_jid)}
                          className="w-4 h-4 rounded accent-oguri-purple"
                        />
                        <span className="text-sm text-gray-300 flex-1 group-hover:text-oguri-lavender transition-colors">{group.nombre}</span>
                        {group.participantes && (
                          <span className="text-xs text-gray-500 bg-oguri-phantom-700/30 px-2 py-0.5 rounded-full">{group.participantes} miembros</span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Canales - Solo visible si está activado */}
            {targets.channels && getFilteredGroups('channel').length > 0 && (
              <div className="rounded-xl border border-oguri-blue/30 bg-gradient-to-br from-oguri-blue/10 to-oguri-cyan/5 overflow-hidden animate-slide-up backdrop-blur-sm">
                <button
                  onClick={() => toggleSection('channels')}
                  className="w-full flex items-center justify-between p-4 hover:bg-oguri-blue/15 transition-all duration-300"
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-300" />
                    <span className="text-sm font-medium text-blue-200">
                      Canales ({getFilteredGroups('channel').filter(g => selectedJids.has(g.wa_jid)).length}/{getFilteredGroups('channel').length})
                    </span>
                  </div>
                  {expandedSections.channels ? (
                    <ChevronUp className="w-4 h-4 text-blue-300" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-blue-300" />
                  )}
                </button>
                {expandedSections.channels && (
                  <div className="border-t border-oguri-blue/20 p-3 space-y-2 max-h-48 overflow-y-auto animate-slide-down">
                    <div className="flex gap-2 mb-2">
                      <button
                        onClick={() => selectAllOfType('channel')}
                        className="text-xs px-3 py-1.5 rounded-lg bg-oguri-blue/30 text-blue-200 hover:bg-oguri-blue/40 transition-all duration-200 border border-oguri-blue/30"
                      >
                        Seleccionar todos
                      </button>
                      <button
                        onClick={() => deselectAllOfType('channel')}
                        className="text-xs px-3 py-1.5 rounded-lg bg-oguri-phantom-700/30 text-gray-300 hover:bg-oguri-phantom-600/40 transition-all duration-200 border border-oguri-phantom-600/30"
                      >
                        Deseleccionar todos
                      </button>
                    </div>
                    {getFilteredGroups('channel').map(group => (
                      <label key={group.wa_jid} className="flex items-center gap-2 p-2 rounded-lg hover:bg-oguri-blue/15 cursor-pointer transition-all duration-200 group">
                        <input
                          type="checkbox"
                          checked={selectedJids.has(group.wa_jid)}
                          onChange={() => toggleJid(group.wa_jid)}
                          className="w-4 h-4 rounded accent-oguri-blue"
                        />
                        <span className="text-sm text-gray-300 flex-1 group-hover:text-blue-200 transition-colors">{group.nombre}</span>
                        {group.participantes && (
                          <span className="text-xs text-gray-500 bg-oguri-phantom-700/30 px-2 py-0.5 rounded-full">{group.participantes} miembros</span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Comunidades - Solo visible si está activado */}
            {targets.communities && getFilteredGroups('community').length > 0 && (
              <div className="rounded-xl border border-oguri-cyan/30 bg-gradient-to-br from-oguri-cyan/10 to-oguri-blue/5 overflow-hidden animate-slide-up backdrop-blur-sm">
                <button
                  onClick={() => toggleSection('communities')}
                  className="w-full flex items-center justify-between p-4 hover:bg-oguri-cyan/15 transition-all duration-300"
                >
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-cyan-300" />
                    <span className="text-sm font-medium text-cyan-200">
                      Comunidades ({getFilteredGroups('community').filter(g => selectedJids.has(g.wa_jid)).length}/{getFilteredGroups('community').length})
                    </span>
                  </div>
                  {expandedSections.communities ? (
                    <ChevronUp className="w-4 h-4 text-cyan-300" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-cyan-300" />
                  )}
                </button>
                {expandedSections.communities && (
                  <div className="border-t border-oguri-cyan/20 p-3 space-y-2 max-h-48 overflow-y-auto animate-slide-down">
                    <div className="flex gap-2 mb-2">
                      <button
                        onClick={() => selectAllOfType('community')}
                        className="text-xs px-3 py-1.5 rounded-lg bg-oguri-cyan/30 text-cyan-200 hover:bg-oguri-cyan/40 transition-all duration-200 border border-oguri-cyan/30"
                      >
                        Seleccionar todos
                      </button>
                      <button
                        onClick={() => deselectAllOfType('community')}
                        className="text-xs px-3 py-1.5 rounded-lg bg-oguri-phantom-700/30 text-gray-300 hover:bg-oguri-phantom-600/40 transition-all duration-200 border border-oguri-phantom-600/30"
                      >
                        Deseleccionar todos
                      </button>
                    </div>
                    {getFilteredGroups('community').map(group => (
                      <label key={group.wa_jid} className="flex items-center gap-2 p-2 rounded-lg hover:bg-oguri-cyan/15 cursor-pointer transition-all duration-200 group">
                        <input
                          type="checkbox"
                          checked={selectedJids.has(group.wa_jid)}
                          onChange={() => toggleJid(group.wa_jid)}
                          className="w-4 h-4 rounded accent-oguri-cyan"
                        />
                        <span className="text-sm text-gray-300 flex-1 group-hover:text-cyan-200 transition-colors">{group.nombre}</span>
                        {group.participantes && (
                          <span className="text-xs text-gray-500 bg-oguri-phantom-700/30 px-2 py-0.5 rounded-full">{group.participantes} miembros</span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {groups.length === 0 && !loadingGroups && (
              <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                No hay grupos, canales o comunidades disponibles
              </div>
            )}
          </div>
        )}

        {/* Resumen de destinos seleccionados */}
        {(targets.groups || targets.channels || targets.communities) && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 backdrop-blur-sm animate-fade-in">
            <p className="text-sm font-medium text-green-200 mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Total seleccionados: {selectedJids.size}
            </p>
            <div className="text-xs text-green-300">
              {selectedJids.size === 0 ? (
                <span className="flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Ningún destino seleccionado específicamente
                </span>
              ) : (
                <span>✓ Listos para enviar a {selectedJids.size} destino{selectedJids.size !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        )}

        {/* Mensaje */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
            Contenido del Mensaje
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-oguri-purple/20 text-oguri-lavender border border-oguri-purple/30">
              Soporta Markdown
            </span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escribe el aviso global aquí..."
            className="w-full h-32 p-4 rounded-xl bg-oguri-phantom-900/40 border border-oguri-phantom-600/30 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-oguri-purple/50 focus:border-oguri-lavender/50 transition-all resize-none backdrop-blur-sm"
          />
        </div>

        {/* Advertencia */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 flex gap-3 backdrop-blur-sm">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-200/80 leading-relaxed">
            <strong>Nota de seguridad:</strong> Los mensajes se envían con un intervalo de 1.5 segundos para evitar que WhatsApp detecte spam y bloquee el número del bot. El proceso se ejecuta en segundo plano.
          </p>
        </div>

        {/* Botón de Envío */}
        <Button
          onClick={handleSend}
          disabled={isSending || !message.trim()}
          className="w-full py-6 rounded-xl text-base font-bold bg-gradient-to-r from-oguri-purple to-oguri-lavender hover:from-oguri-lavender hover:to-oguri-blue shadow-glow-oguri-mixed transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
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
