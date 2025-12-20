'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Terminal, Play, Copy, Check, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import api from '@/services/api';
import toast from 'react-hot-toast';

interface BotCommand {
  cmd: string;
  desc: string;
  category: string;
}

export default function BotCommandsPage() {
  const [command, setCommand] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);
  const [output, setOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [commands, setCommands] = useState<BotCommand[]>([]);
  const [loadingCommands, setLoadingCommands] = useState(true);

  useEffect(() => {
    loadCommands();
    loadGroups();
  }, []);

  // Auto-refresh cada 2 minutos para comandos y grupos
  useEffect(() => {
    const interval = setInterval(() => {
      loadCommands();
      loadGroups();
    }, 120000);
    return () => clearInterval(interval);
  }, []);

  const loadGroups = async () => {
    try {
      const response = await api.getAvailableGrupos();
      setAvailableGroups(response?.grupos || []);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const loadCommands = async () => {
    setLoadingCommands(true);
    try {
      const response = await api.getBotCommandHelp();
      if (response?.commands && Array.isArray(response.commands)) {
        setCommands(response.commands.map((c: any) => ({
          cmd: c.command || c.cmd || c.name,
          desc: c.description || c.desc || '',
          category: c.category || 'General'
        })));
      } else {
        // Fallback a comandos básicos si el backend no responde
        setCommands([
          { cmd: '.menu', desc: 'Muestra el menú principal', category: 'General' },
          { cmd: '.help', desc: 'Ayuda sobre comandos', category: 'General' },
          { cmd: '.ping', desc: 'Verifica la latencia', category: 'General' },
          { cmd: '.info', desc: 'Información del bot', category: 'General' },
        ]);
      }
    } catch (error) {
      console.error('Error loading commands:', error);
      setCommands([
        { cmd: '.menu', desc: 'Muestra el menú principal', category: 'General' },
        { cmd: '.help', desc: 'Ayuda sobre comandos', category: 'General' },
        { cmd: '.ping', desc: 'Verifica la latencia', category: 'General' },
      ]);
    } finally {
      setLoadingCommands(false);
    }
  };

  const handleExecute = async () => {
    if (!command.trim()) return;
    setIsLoading(true);
    try {
      const result = await api.executeBotCommand(command, selectedGroup || undefined);
      setOutput(JSON.stringify(result, null, 2));
      toast.success('Comando ejecutado');
    } catch (error: any) {
      setOutput(`Error: ${error?.response?.data?.error || error?.message || 'Error desconocido'}`);
      toast.error('Error al ejecutar');
    } finally {
      setIsLoading(false);
    }
  };

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 2000);
    toast.success('Copiado');
  };

  const categories = [...new Set(commands.map(c => c.category))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-3xl font-bold text-white">Bot Commands</h1>
          <p className="text-gray-400 mt-1">Ejecuta y prueba comandos del bot</p>
        </motion.div>
        <Button variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={loadCommands} loading={loadingCommands}>
          Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Command Input */}
        <Card animated delay={0.1} className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Ejecutar Comando</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Grupo (opcional)</label>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="input-glass w-full"
              >
                <option value="">Todos los grupos</option>
                {availableGroups.map((group) => (
                  <option key={group.jid} value={group.jid}>
                    {group.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative">
              <Terminal className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleExecute()}
                placeholder="Escribe un comando..."
                className="input-glass pl-12 font-mono"
              />
            </div>
            <Button variant="primary" className="w-full" icon={<Play className="w-4 h-4" />} onClick={handleExecute} loading={isLoading}>
              Ejecutar {selectedGroup ? 'en Grupo Específico' : 'Globalmente'}
            </Button>
          </div>

          {output && (
            <div className="mt-4 p-4 rounded-xl bg-dark-900 border border-white/10">
              <p className="text-xs text-gray-500 mb-2">Output:</p>
              <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap overflow-x-auto">{output}</pre>
            </div>
          )}
        </Card>

        {/* Commands List */}
        <Card animated delay={0.2} className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Comandos Disponibles</h3>
          {loadingCommands ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 text-primary-400 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {categories.map(category => (
                <div key={category}>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">{category}</h4>
                  <div className="space-y-2">
                    {commands.filter(c => c.category === category).map((cmd, i) => (
                      <motion.div
                        key={cmd.cmd}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <div>
                          <code className="text-primary-400 font-mono">{cmd.cmd}</code>
                          <p className="text-xs text-gray-500 mt-1">{cmd.desc}</p>
                        </div>
                        <button
                          onClick={() => copyCommand(cmd.cmd)}
                          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          {copiedCmd === cmd.cmd ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}