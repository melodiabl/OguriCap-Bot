'use client';

import React, { useState, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Mail, Bell, Send, Eye, Loader2, Sparkles, Type, Radio, Users, Zap, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import api from '@/services/api';
import { notify } from '@/lib/notif';
import { cn } from '@/lib/utils';

const labelCls = 'text-[10px] font-black uppercase tracking-widest text-muted-foreground';
const inputCls = 'w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-foreground text-sm focus:border-primary/50 outline-none transition-all placeholder:text-muted-foreground/60';
const textareaCls = `${inputCls} resize-none h-24`;

export default function BroadcastPage() {
  const reduceMotion = useReducedMotion();
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSendingPush, setIsSendingPush] = useState(false);
  const [isSendingFull, setIsSendingFull] = useState(false);
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  const openEmailPreview = useCallback(async () => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const res = await api.post('/api/email/preview', { subject: subject || title || 'Broadcast', title: title || subject || 'Broadcast', content: message });
      setPreviewHtml(res.data?.html || '');
    } catch {
      setPreviewHtml('');
      notify.error('No se pudo generar el preview');
    } finally {
      setPreviewLoading(false);
    }
  }, [subject, title, message]);

  const sendEmailBroadcast = async () => {
    if (!subject.trim()) { notify.error('El asunto es requerido'); return; }
    if (!message.trim()) { notify.error('El mensaje es requerido'); return; }
    setIsSendingEmail(true);
    try {
      const res = await api.sendEmailBroadcast({ subject, preheader: message.substring(0, 100), title: title || subject, message });
      if (res.success) {
        notify.success(`Email broadcast enviado a ${res.recipientsCount || 'todos'} usuarios`);
        setSubject(''); setTitle(''); setMessage('');
      } else notify.error(res.error || 'Error al enviar');
    } catch (error: any) {
      notify.error(error.response?.data?.error || 'Error al enviar email');
    } finally { setIsSendingEmail(false); }
  };

  const sendPushBroadcast = async () => {
    if (!pushTitle.trim()) { notify.error('El título es requerido'); return; }
    setIsSendingPush(true);
    try {
      const res = await api.sendPushBroadcast({ title: pushTitle, body: pushBody, tag: 'broadcast' });
      if (res.success) { notify.success('Notificación push enviada'); setPushTitle(''); setPushBody(''); }
      else notify.error(res.error || 'Error al enviar');
    } catch (error: any) {
      notify.error(error.response?.data?.error || 'Error al enviar push');
    } finally { setIsSendingPush(false); }
  };

  const sendFullBroadcast = async () => {
    if (!title.trim()) { notify.error('El título es requerido'); return; }
    if (!message.trim()) { notify.error('El mensaje es requerido'); return; }
    setIsSendingFull(true);
    try {
      const res = await api.sendFullBroadcast({ subject: subject || title, preheader: message.substring(0, 100), title, message });
      if (res.success) {
        notify.success('Broadcast completo enviado a todos los usuarios');
        setSubject(''); setTitle(''); setMessage(''); setPushTitle(''); setPushBody('');
      } else notify.error(res.error || 'Error al enviar');
    } catch (error: any) {
      notify.error(error.response?.data?.error || 'Error al enviar broadcast');
    } finally { setIsSendingFull(false); }
  };

  const broadcastLanes = [
    {
      label: 'Canal email',
      value: 'SMTP Activo',
      description: 'Envío masivo de correos con plantillas responsivas a todos los usuarios.',
      icon: <Mail className="w-4 h-4" />,
      badge: 'smtp',
      badgeClassName: 'border-info/20 bg-info/10 text-info',
      glowClassName: 'from-info/18 via-oguri-blue/10 to-transparent',
    },
    {
      label: 'Canal push',
      value: 'WebPush',
      description: 'Notificaciones en tiempo real para usuarios con el panel abierto.',
      icon: <Bell className="w-4 h-4" />,
      badge: 'push',
      badgeClassName: 'border-success/20 bg-success/10 text-success',
      glowClassName: 'from-success/16 via-oguri-cyan/10 to-transparent',
    },
    {
      label: 'Alcance',
      value: 'Multi-canal',
      description: 'Combina email y push para llegar a toda la base de usuarios registrada.',
      icon: <Users className="w-4 h-4" />,
      badge: 'all',
      badgeClassName: 'border-oguri-gold/20 bg-oguri-gold/10 text-oguri-gold',
      glowClassName: 'from-oguri-gold/16 via-oguri-purple/10 to-transparent',
    },
    {
      label: 'Modo avanzado',
      value: 'Email + Push',
      description: 'Broadcast completo simultáneo. Un solo clic para todos los canales.',
      icon: <Sparkles className="w-4 h-4" />,
      badge: 'combo',
      badgeClassName: 'border-accent/20 bg-accent/10 text-accent',
      glowClassName: 'from-accent/18 via-oguri-lavender/10 to-transparent',
    },
  ];

  return (
    <div className="panel-page relative overflow-hidden">
      {/* Atmosphere */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[-8%] top-[-4rem] -z-10 h-[420px] overflow-hidden">
        <div className="module-atmosphere" />
        <motion.div
          className="absolute left-[8%] top-[12%] h-52 w-52 rounded-full bg-info/16 blur-3xl"
          animate={reduceMotion ? { opacity: 0.2 } : { x: [0, 18, 0], y: [0, 14, 0], opacity: [0.18, 0.36, 0.18] }}
          transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 11, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-[10%] top-[10%] h-56 w-56 rounded-full bg-oguri-gold/14 blur-3xl"
          animate={reduceMotion ? { opacity: 0.16 } : { x: [0, -18, 0], y: [0, 18, 0], opacity: [0.14, 0.32, 0.14] }}
          transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 10.4, ease: 'easeInOut', delay: 0.6 }}
        />
      </div>

      {/* Hero */}
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
              <Send className="h-3.5 w-3.5 text-info" />
              Centro de difusión
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Broadcast multi-canal OguriCap</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-gray-300">
              Email masivo, notificaciones push y difusión combinada para toda la base de usuarios del panel.
            </p>
          </div>
          <div className="panel-hero-meta-grid">
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Email</p>
              <p className="mt-2 text-lg font-black text-white">SMTP</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Push</p>
              <p className="mt-2 text-lg font-black text-white">WebPush</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Canales</p>
              <p className="mt-2 text-lg font-black text-white">2</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Lane cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {broadcastLanes.map((lane, index) => (
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

      {/* PageHeader */}
      <PageHeader
        title="Broadcast"
        description="Envía notificaciones masivas por email y push a todos los usuarios."
        icon={<Send className="w-6 h-6 text-info" />}
      />

      {/* Email + Push cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Email Broadcast */}
        <Card className="overflow-hidden border-white/10 bg-card/30 backdrop-blur-xl">
          <div className="p-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-info/15 border border-info/25 flex items-center justify-center">
                <Mail className="w-5 h-5 text-info" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Email Broadcast</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Envía correos a múltiples destinatarios</p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className={labelCls}>Asunto</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className={inputCls} placeholder="Asunto del email..." />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Título</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputCls} placeholder="Título visible en el email..." />
            </div>
            <div className="space-y-1.5">
              <label className={cn(labelCls, 'flex items-center gap-1.5')}>
                <Type className="w-3 h-3" /> Mensaje
              </label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} className={textareaCls} placeholder="Escribe tu mensaje... se enviará a todos los usuarios" />
            </div>
            <div className="flex gap-2 flex-wrap pt-1">
              <Button onClick={sendEmailBroadcast} loading={isSendingEmail} disabled={!subject.trim() || !message.trim()} variant="primary" icon={<Mail className="w-4 h-4" />}>
                Enviar a Todos
              </Button>
              <Button onClick={openEmailPreview} variant="secondary" icon={<Eye className="w-4 h-4" />}>
                Preview
              </Button>
            </div>
          </div>
        </Card>

        {/* Push Notifications */}
        <Card className="overflow-hidden border-white/10 bg-card/30 backdrop-blur-xl">
          <div className="p-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-success/15 border border-success/25 flex items-center justify-center">
                <Bell className="w-5 h-5 text-success" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Push Notifications</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Notificaciones en tiempo real</p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className={labelCls}>Título</label>
              <input type="text" value={pushTitle} onChange={e => setPushTitle(e.target.value)} className={inputCls} placeholder="Título de la notificación..." />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Mensaje</label>
              <textarea value={pushBody} onChange={e => setPushBody(e.target.value)} className={textareaCls} placeholder="Contenido de la notificación..." />
            </div>
            <div className="pt-1">
              <Button onClick={sendPushBroadcast} loading={isSendingPush} disabled={!pushTitle.trim()} variant="primary" icon={<Bell className="w-4 h-4" />}>
                Enviar Push
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Full Broadcast */}
      <Card className="overflow-hidden border-white/10 bg-card/30 backdrop-blur-xl">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-oguri-gold/15 border border-oguri-gold/25 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-oguri-gold" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Broadcast Completo</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Envía email + push simultáneamente a todos los usuarios</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelCls}>Título del mensaje</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputCls} placeholder="Título para email y push..." />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Asunto (email)</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className={inputCls} placeholder="Asunto del email..." />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Mensaje</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} className={textareaCls} placeholder="Contenido del mensaje..." />
          </div>

          <div className="flex items-center gap-3 p-4 rounded-2xl bg-oguri-gold/5 border border-oguri-gold/15 mt-2">
            <CheckCircle className="h-5 w-5 text-oguri-gold shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              El broadcast completo envía el mismo contenido por email y notificación push simultáneamente a todos los usuarios registrados.
            </p>
          </div>

          <div className="pt-1">
            <Button
              onClick={sendFullBroadcast}
              loading={isSendingFull}
              disabled={!title.trim() || !message.trim()}
              variant="primary"
              icon={<Send className="w-4 h-4" />}
            >
              Enviar a Todos (Email + Push)
            </Button>
          </div>
        </div>
      </Card>

      {/* Preview Modal */}
      {previewOpen && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4 lg:pl-[calc(18rem+1rem)] backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setPreviewOpen(false); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="bg-card rounded-[24px] p-5 w-full max-w-xl flex flex-col border border-white/10 shadow-2xl overflow-hidden"
            style={{ maxHeight: 'calc(100dvh - 2rem)' }}
          >
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Preview del Email</h3>
                {(subject || title) && <p className="text-xs text-muted-foreground mt-0.5">Asunto: {subject || title}</p>}
              </div>
              <Button onClick={() => setPreviewOpen(false)} variant="secondary" size="sm">Cerrar</Button>
            </div>

            <div className="flex-1 min-h-0 rounded-2xl border border-white/10 overflow-hidden">
              {previewLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground" style={{ minHeight: 300 }}>
                  <Loader2 className="w-7 h-7 animate-spin text-primary" />
                  <span className="text-sm">Generando vista previa...</span>
                </div>
              ) : previewHtml ? (
                <iframe srcDoc={previewHtml} className="w-full bg-white rounded-xl" style={{ height: 360 }} title="Email Preview" sandbox="allow-same-origin" />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm" style={{ minHeight: 300 }}>
                  <Mail className="w-8 h-8 opacity-30" />
                  <span>Escribe un mensaje para ver el preview</span>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
