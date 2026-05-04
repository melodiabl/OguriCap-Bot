'use client';

import React, { useState, useCallback } from 'react';
import { Mail, Bell, Send, Eye, Loader2, AlertCircle, CheckCircle2, Sparkles, Type } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import api from '@/services/api';
import { notify } from '@/lib/notif';

const EMAIL_PREVIEW_TEMPLATES = [
  { id: 'broadcast_announcement', label: 'Anuncio' },
  { id: 'broadcast_update', label: 'Novedades' },
  { id: 'broadcast_alert', label: 'Alerta' },
  { id: 'role_updated', label: 'Promoción' },
];

export default function BroadcastPage() {
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [recipients, setRecipients] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSendingPush, setIsSendingPush] = useState(false);
  const [isSendingFull, setIsSendingFull] = useState(false);
  
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewTemplate, setPreviewTemplate] = useState('broadcast_announcement');

  const openEmailPreview = useCallback(async (template: string = 'broadcast_announcement') => {
    setPreviewTemplate(template);
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const preview = await api.getEmailTemplatePreview(template);
      setPreviewData(preview || null);
    } catch {
      setPreviewData(null);
      notify.error('No se pudo cargar el preview');
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const sendEmailBroadcast = async () => {
    if (!subject.trim()) {
      notify.error('El asunto es requerido');
      return;
    }
    if (!message.trim()) {
      notify.error('El mensaje es requerido');
      return;
    }

    setIsSendingEmail(true);
    try {
      const res = await api.sendEmailBroadcast({
        subject,
        preheader: message.substring(0, 100),
        title: title || subject,
        message,
      });
      
      if (res.success) {
        notify.success(`Email broadcast enviado a ${res.recipientsCount || 'todos'} usuarios`);
        setSubject('');
        setTitle('');
        setMessage('');
      } else {
        notify.error(res.error || 'Error al enviar');
      }
    } catch (error: any) {
      notify.error(error.response?.data?.error || 'Error al enviar email');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const sendPushBroadcast = async () => {
    if (!pushTitle.trim()) {
      notify.error('El título es requerido');
      return;
    }

    setIsSendingPush(true);
    try {
      const res = await api.sendPushBroadcast({
        title: pushTitle,
        body: pushBody,
        tag: 'broadcast',
      });
      
      if (res.success) {
        notify.success('Notificación push enviada');
        setPushTitle('');
        setPushBody('');
      } else {
        notify.error(res.error || 'Error al enviar');
      }
    } catch (error: any) {
      notify.error(error.response?.data?.error || 'Error al enviar push');
    } finally {
      setIsSendingPush(false);
    }
  };

  const sendFullBroadcast = async () => {
    if (!title.trim()) {
      notify.error('El título es requerido');
      return;
    }
    if (!message.trim()) {
      notify.error('El mensaje es requerido');
      return;
    }

    setIsSendingFull(true);
    try {
      const res = await api.sendFullBroadcast({
        subject: subject || title,
        preheader: message.substring(0, 100),
        title,
        message,
      });
      
      if (res.success) {
        notify.success('Broadcast completo enviado a todos los usuarios');
        setSubject('');
        setTitle('');
        setMessage('');
        setPushTitle('');
        setPushBody('');
      } else {
        notify.error(res.error || 'Error al enviar');
      }
    } catch (error: any) {
      notify.error(error.response?.data?.error || 'Error al enviar broadcast');
    } finally {
      setIsSendingFull(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-gradient-oguri-primary shadow-glow-oguri-mixed">
          <Send className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Broadcast</h1>
          <p className="text-sm text-gray-400">Envía notificaciones por email y push</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Email Broadcast */}
        <Card className="p-6 border border-oguri-purple/20 bg-gradient-oguri-phantom">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-info/20">
              <Mail className="w-5 h-5 text-info" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Email Broadcast</h3>
              <p className="text-xs text-gray-400">Envía correos a múltiples destinatarios</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-300">Asunto</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="input-glass w-full mt-1"
                placeholder="Asunto del email..."
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300">Título</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-glass w-full mt-1"
                placeholder="Título visible en el email..."
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Type className="w-4 h-4" />
                Mensaje
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="input-glass w-full mt-1 h-24"
                placeholder="Escribe tu mensaje aquí... se enviará a todos los usuarios registrados"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={sendEmailBroadcast}
                loading={isSendingEmail}
                disabled={!subject.trim() || !message.trim()}
                variant="primary"
                className="flex items-center gap-2"
              >
                <Mail className="w-4 h-4" />
                Enviar a Todos
              </Button>
              <Button
                onClick={() => openEmailPreview(previewTemplate)}
                variant="secondary"
                className="flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Preview
              </Button>
            </div>
          </div>
        </Card>

        {/* Push Notifications */}
        <Card className="p-6 border border-oguri-blue/20 bg-gradient-oguri-phantom">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-success/20">
              <Bell className="w-5 h-5 text-success/80" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Push Notifications</h3>
              <p className="text-xs text-gray-400">Envía notificaciones en tiempo real</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-300">Título</label>
              <input
                type="text"
                value={pushTitle}
                onChange={(e) => setPushTitle(e.target.value)}
                className="input-glass w-full mt-1"
                placeholder="Título de la notificación..."
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300">Mensaje</label>
              <textarea
                value={pushBody}
                onChange={(e) => setPushBody(e.target.value)}
                className="input-glass w-full mt-1 h-24"
                placeholder="Contenido de la notificación..."
              />
            </div>

            <Button
              onClick={sendPushBroadcast}
              loading={isSendingPush}
              disabled={!pushTitle.trim()}
              variant="primary"
              className="flex items-center gap-2"
            >
              <Bell className="w-4 h-4" />
              Enviar Push
            </Button>
          </div>
        </Card>
      </div>

      {/* Full Broadcast */}
      <Card className="p-6 border border-oguri-cyan/20 bg-gradient-oguri-phantom">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-oguri-gold/20">
            <Sparkles className="w-5 h-5 text-oguri-gold" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Broadcast Completo</h3>
            <p className="text-xs text-gray-400">Envía email + push simultaneously</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-300">Título del mensaje</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-glass w-full mt-1"
              placeholder="Título para email y push..."
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-300">Asunto (email)</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="input-glass w-full mt-1"
              placeholder="Asunto del email..."
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium text-gray-300">Mensaje</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="input-glass w-full mt-1 h-24"
            placeholder="Contenido del mensaje..."
          />
        </div>

        <div className="mt-6 flex gap-3">
          <Button
            onClick={sendFullBroadcast}
            loading={isSendingFull}
            disabled={!title.trim() || !message.trim()}
            className="bg-gradient-to-r from-oguri-cyan to-oguri-blue"
          >
            <Send className="w-4 h-4 mr-2" />
            Enviar a Todos (Email + Push)
          </Button>
        </div>
      </Card>

      {/* Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Preview Email</h3>
              <Button onClick={() => setPreviewOpen(false)} variant="secondary" size="sm">
                Cerrar
              </Button>
            </div>

            <div className="flex gap-2 mb-4 flex-wrap">
              {EMAIL_PREVIEW_TEMPLATES.map((t) => (
                <Button
                  key={t.id}
                  onClick={() => openEmailPreview(t.id)}
                  variant={previewTemplate === t.id ? 'primary' : 'secondary'}
                  size="sm"
                >
                  {t.label}
                </Button>
              ))}
            </div>

            {previewLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-oguri-purple" />
              </div>
            ) : previewData ? (
              <div className="border border-white/10 rounded-xl overflow-hidden">
                <div 
                  className="p-4 bg-white text-black"
                  dangerouslySetInnerHTML={{ __html: previewData.html || '' }}
                />
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                No hay preview disponible
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}