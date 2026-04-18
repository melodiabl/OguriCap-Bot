'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle,
  Clock3,
  Download,
  Gamepad2,
  Gauge,
  Image as ImageIcon,
  Lock,
  MessageSquare,
  Package,
  Radio,
  Send,
  Server,
  Shield,
  Sparkles,
  Terminal,
  Users,
  Zap,
} from 'lucide-react';

const featureGroups = [
  {
    title: 'Comunidad activa',
    description: 'Bienvenida, menciones, reglas, admins, warns, tagall, hidetag y control de actividad.',
    icon: Users,
    accent: 'text-[#25d366]',
    pulse: 'from-[#25d366] to-[#2dd4bf]',
  },
  {
    title: 'Diversion y juegos',
    description: 'RPG, economia, casino, ruleta, minas, aventura, perfiles, niveles y rankings.',
    icon: Gamepad2,
    accent: 'text-[#ff4d8d]',
    pulse: 'from-[#ff4d8d] to-[#f59e0b]',
  },
  {
    title: 'Gacha y waifus',
    description: 'Rolls, claims, harem, trades, rarezas, top waifus y coleccion viva por usuario.',
    icon: Sparkles,
    accent: 'text-[#f59e0b]',
    pulse: 'from-[#f59e0b] to-[#25d366]',
  },
  {
    title: 'Multimedia rapida',
    description: 'Stickers, imagen a sticker, musica, descargas, letras, busquedas y contenido compartido.',
    icon: ImageIcon,
    accent: 'text-[#2dd4bf]',
    pulse: 'from-[#2dd4bf] to-[#7dd3fc]',
  },
  {
    title: 'Herramientas utiles',
    description: 'Traductor, Wikipedia, Google, IP lookup, screenshots web, QR, uploader y utilidades diarias.',
    icon: Terminal,
    accent: 'text-[#7dd3fc]',
    pulse: 'from-[#7dd3fc] to-[#25d366]',
  },
  {
    title: 'SubBots y panel',
    description: 'Instancias separadas, estado del bot, grupos, aportes, recursos, logs, alertas y tareas.',
    icon: Bot,
    accent: 'text-[#a3e635]',
    pulse: 'from-[#a3e635] to-[#ff4d8d]',
  },
];

const liveCommands = [
  '/menu',
  '/sticker',
  '/play',
  '/daily',
  '/mine',
  '/rollwaifu',
  '/tagall',
  '/hidetag',
  '/traducir',
  '/spotify',
  '/warns',
  '/infogrupo',
  '/top',
  '/claim',
];

const commandCategories = [
  {
    title: 'Grupo',
    color: 'text-[#25d366]',
    commands: ['/menu', '/admins', '/tagall', '/hidetag', '/warns', '/infogrupo'],
  },
  {
    title: 'RPG',
    color: 'text-[#ff4d8d]',
    commands: ['/daily', '/work', '/mine', '/hunt', '/casino', '/baltop'],
  },
  {
    title: 'Gacha',
    color: 'text-[#f59e0b]',
    commands: ['/rollwaifu', '/harem', '/claim', '/trade', '/winfo', '/topwaifus'],
  },
  {
    title: 'Media',
    color: 'text-[#2dd4bf]',
    commands: ['/sticker', '/toimg', '/play', '/spotify', '/tiktok', '/pinterest'],
  },
];

const panelHighlights = [
  { label: 'Bot principal', value: 'conexion y QR', icon: Bot, tone: 'text-[#25d366]' },
  { label: 'Grupos', value: 'sync y permisos', icon: MessageSquare, tone: 'text-[#2dd4bf]' },
  { label: 'Aportes', value: 'revision y estados', icon: Package, tone: 'text-[#ff4d8d]' },
  { label: 'Recursos', value: 'CPU, memoria y disco', icon: Server, tone: 'text-[#f59e0b]' },
  { label: 'Alertas', value: 'eventos importantes', icon: Shield, tone: 'text-[#a3e635]' },
  { label: 'Logs', value: 'lectura tecnica', icon: Activity, tone: 'text-[#7dd3fc]' },
];

const botFlow = [
  { command: '/menu', response: 'Grupo, RPG, Gacha, Media, Tools.' },
  { command: '/sticker', response: 'Envia imagen. La convierto ahora.' },
  { command: '/daily', response: '+350 coins. Racha activa.' },
  { command: '/tagall', response: 'Mencion lista para admins.' },
];

const activityRows = [
  { label: 'Mensajes procesados', value: '1.2k', icon: MessageSquare, color: 'bg-[#25d366]' },
  { label: 'Stickers creados', value: '342', icon: ImageIcon, color: 'bg-[#2dd4bf]' },
  { label: 'Partidas RPG', value: '89', icon: Gamepad2, color: 'bg-[#ff4d8d]' },
  { label: 'Alertas resueltas', value: '27', icon: Shield, color: 'bg-[#f59e0b]' },
];

const panelOps = [
  { label: 'Estado bot', value: 'online', icon: Bot, tone: 'text-[#25d366]', progress: 100 },
  { label: 'CPU host', value: '38%', icon: Gauge, tone: 'text-[#2dd4bf]', progress: 38 },
  { label: 'Comunidad', value: 'sync', icon: Users, tone: 'text-[#ff4d8d]', progress: 74 },
  { label: 'Alertas', value: '3 live', icon: Shield, tone: 'text-[#f59e0b]', progress: 52 },
];

const controlRoutes = [
  { label: 'Dashboard', icon: Activity, color: 'bg-[#25d366]' },
  { label: 'Bot', icon: Bot, color: 'bg-[#2dd4bf]' },
  { label: 'Grupos', icon: MessageSquare, color: 'bg-[#ff4d8d]' },
  { label: 'Recursos', icon: Server, color: 'bg-[#f59e0b]' },
  { label: 'Aportes', icon: Package, color: 'bg-[#a3e635]' },
];

const liveAudit = [
  { title: 'QR y sesion sincronizados', meta: 'bot principal', tone: 'text-[#25d366]' },
  { title: 'SubBot listo para comandos', meta: 'instancia secundaria', tone: 'text-[#2dd4bf]' },
  { title: 'Grupo actualizado', meta: 'permisos y reglas', tone: 'text-[#ff4d8d]' },
];

function FloatingSignal({ delay = 0, className = '' }: { delay?: number; className?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      aria-hidden="true"
      className={`absolute h-px bg-gradient-to-r from-transparent via-[#25d366]/80 to-transparent ${className}`}
      animate={reduceMotion ? { opacity: 0.48 } : { x: ['-14%', '14%', '-14%'], opacity: [0.12, 0.88, 0.12] }}
      transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 5.8, delay, ease: 'easeInOut' }}
    />
  );
}

function CommandTicker({ reverse = false }: { reverse?: boolean }) {
  const reduceMotion = useReducedMotion();
  const commands = [...liveCommands, ...liveCommands];

  return (
    <div className="relative overflow-hidden border-y border-white/10 bg-white/[0.035] py-3">
      <motion.div
        className="flex w-max gap-3"
        animate={reduceMotion ? { x: 0 } : { x: reverse ? ['-50%', '0%'] : ['0%', '-50%'] }}
        transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 24, ease: 'linear' }}
      >
        {commands.map((command, index) => (
          <span
            key={`${command}-${index}`}
            className="inline-flex items-center gap-2 rounded-lg border border-[#25d366]/18 bg-[#0d0f0e]/80 px-4 py-2 font-mono text-xs font-black text-[#c7f9d8] shadow-[0_0_24px_rgba(37,211,102,0.08)]"
          >
            <span className="h-1.5 w-1.5 rounded-lg bg-[#25d366]" />
            {command}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

function FloatingCommandCloud() {
  const reduceMotion = useReducedMotion();

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
      {[
        { text: '/play', className: 'left-[52%] top-[22%]', delay: 0, color: 'border-[#2dd4bf]/35 text-[#b9fff5]' },
        { text: '/daily', className: 'left-[76%] top-[18%]', delay: 0.8, color: 'border-[#25d366]/35 text-[#c7f9d8]' },
        { text: '/rollwaifu', className: 'left-[60%] top-[72%]', delay: 1.3, color: 'border-[#ff4d8d]/35 text-[#ffd1df]' },
        { text: '/tagall', className: 'left-[84%] top-[56%]', delay: 1.9, color: 'border-[#f59e0b]/35 text-[#ffe4a3]' },
      ].map((item) => (
        <motion.span
          key={item.text}
          className={`absolute rounded-lg border bg-[#0d0f0e]/70 px-3 py-2 font-mono text-xs font-black backdrop-blur-md ${item.className} ${item.color}`}
          animate={reduceMotion ? { opacity: 0.55 } : { y: [0, -18, 0], opacity: [0.42, 1, 0.42] }}
          transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 4.8, delay: item.delay, ease: 'easeInOut' }}
        >
          {item.text}
        </motion.span>
      ))}
    </div>
  );
}

function LiveBotConsole() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="glass-card relative mx-auto mt-10 w-full max-w-[29rem] overflow-hidden rounded-2xl border border-white/20 bg-[#101512]/70 shadow-[0_26px_90px_rgba(37,211,102,0.18)] backdrop-blur-2xl lg:absolute lg:right-0 lg:top-24 lg:mt-0 lg:max-w-[24rem] xl:max-w-[29rem]"
      initial={reduceMotion ? false : { opacity: 0, y: 24, rotate: 1.5 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: [0, -10, 0], rotate: [1.5, 0.4, 1.5] }}
      transition={reduceMotion ? { duration: 0.12 } : { opacity: { duration: 0.5 }, y: { repeat: Infinity, duration: 7, ease: 'easeInOut' }, rotate: { repeat: Infinity, duration: 7, ease: 'easeInOut' } }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#25d366] to-transparent" />
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <Image
            src="/oguricap-avatar.png"
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 rounded-lg object-cover"
            priority
          />
          <div>
            <p className="text-sm font-black text-white">OguriCap-Bot</p>
            <p className="flex items-center gap-2 text-xs font-bold text-[#25d366]">
              <motion.span
                className="h-2 w-2 rounded-lg bg-[#25d366]"
                animate={reduceMotion ? { opacity: 1 } : { scale: [1, 1.6, 1], opacity: [0.65, 1, 0.65] }}
                transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 1.4 }}
              />
              online ahora
            </p>
          </div>
        </div>
        <Radio className="h-5 w-5 text-[#2dd4bf]" />
      </div>

      <div className="space-y-3 p-4">
        {botFlow.map((message, index) => (
          <motion.div
            key={message.command}
            className="space-y-2"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 + index * 0.12 }}
          >
            <div className="flex justify-end">
              <motion.div
                className="rounded-lg bg-[#25d366] px-3 py-2 font-mono text-xs font-black text-[#07100d]"
                animate={reduceMotion ? { opacity: 1 } : { boxShadow: ['0 0 0 rgba(37,211,102,0)', '0 0 26px rgba(37,211,102,0.32)', '0 0 0 rgba(37,211,102,0)'] }}
                transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 3.2, delay: index * 0.4 }}
              >
                {message.command}
              </motion.div>
            </div>
            <div className="flex justify-start">
              <div className="max-w-[84%] rounded-lg border border-white/10 bg-white/[0.07] px-3 py-2 text-sm text-white">
                {message.response}
              </div>
            </div>
          </motion.div>
        ))}

        <div className="flex items-center gap-2 rounded-lg border border-[#2dd4bf]/18 bg-[#2dd4bf]/8 px-3 py-2 text-xs font-bold text-[#b9fff5]">
          <span>Oguri esta escribiendo</span>
          <span className="flex gap-1">
            {[0, 1, 2].map((dot) => (
              <motion.span
                key={dot}
                className="h-1.5 w-1.5 rounded-lg bg-[#2dd4bf]"
                animate={reduceMotion ? { opacity: 0.7 } : { y: [0, -4, 0], opacity: [0.35, 1, 0.35] }}
                transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 0.9, delay: dot * 0.16 }}
              />
            ))}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function ActivityPanel() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="rounded-lg border border-white/10 bg-[#101512] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-white">Actividad en vivo</p>
          <p className="text-xs font-semibold text-white/52">resumen del ecosistema</p>
        </div>
        <Clock3 className="h-5 w-5 text-[#25d366]" />
      </div>

      <div className="space-y-3">
        {activityRows.map((row, index) => {
          const Icon = row.icon;
          return (
            <motion.div
              key={row.label}
              className="rounded-lg border border-white/10 bg-white/[0.035] p-3"
              initial={reduceMotion ? false : { opacity: 0, x: 12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ delay: index * 0.08 }}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-bold text-white/74">
                  <Icon className="h-4 w-4 text-white/54" />
                  {row.label}
                </span>
                <span className="font-mono text-sm font-black text-white">{row.value}</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-lg bg-white/10">
                <motion.div
                  className={`h-full rounded-lg ${row.color}`}
                  animate={reduceMotion ? { width: `${58 + index * 9}%` } : { width: [`${38 + index * 7}%`, `${74 + index * 5}%`, `${52 + index * 8}%`] }}
                  transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 3.8, delay: index * 0.32, ease: 'easeInOut' }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function PanelControlPreview() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      className="glass-card relative overflow-hidden rounded-2xl border border-white/10 bg-[#111713]/80 p-6 shadow-[0_22px_70px_rgba(37,211,102,0.15)] backdrop-blur-xl"
    >
      <motion.div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#2dd4bf] to-transparent"
        animate={reduceMotion ? { opacity: 0.7 } : { x: ['-100%', '100%'] }}
        transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 4, ease: 'linear' }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(37,211,102,0.16),transparent_32%),radial-gradient(circle_at_88%_10%,rgba(45,212,191,0.12),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(255,77,141,0.10),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.14] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:26px_26px]" />

      <div className="relative z-10">
        <div className="mb-5 flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/oguricap-avatar.png"
              alt="OguriCap-Bot"
              width={44}
              height={44}
              className="h-11 w-11 rounded-lg object-cover"
            />
            <div className="min-w-0">
              <p className="text-sm font-black text-white">Centro de control</p>
              <p className="text-xs text-white/56">operacion privada en vivo</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-[#25d366]/25 bg-[#25d366]/10 px-3 py-2 text-xs font-black text-[#c7f9d8]">
            <motion.span
              className="h-2 w-2 rounded-lg bg-[#25d366]"
              animate={reduceMotion ? { opacity: 0.8 } : { scale: [1, 1.6, 1], opacity: [0.45, 1, 0.45] }}
              transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 1.4 }}
            />
            LIVE
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {panelOps.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.label}
                className="rounded-lg border border-white/10 bg-white/[0.045] p-4"
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Icon className={`h-5 w-5 ${item.tone}`} />
                  <span className="font-mono text-xs font-black text-white">{item.value}</span>
                </div>
                <p className="text-xs font-black text-white/68">{item.label}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-lg bg-white/10">
                  <motion.div
                    className="h-full rounded-lg bg-gradient-to-r from-[#25d366] via-[#2dd4bf] to-[#ff4d8d]"
                    animate={reduceMotion ? { width: `${item.progress}%` } : { width: [`${Math.max(18, item.progress - 20)}%`, `${item.progress}%`, `${Math.max(24, item.progress - 10)}%`] }}
                    transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 3.4, delay: index * 0.22, ease: 'easeInOut' }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-4 rounded-lg border border-white/10 bg-black/15 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-black text-white/64">Rutas del panel</p>
            <Lock className="h-4 w-4 text-[#25d366]" />
          </div>
          <div className="flex flex-wrap gap-2">
            {controlRoutes.map((item) => {
              const Icon = item.icon;
              return (
                <span key={item.label} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-bold text-white/76">
                  <span className={`h-2 w-2 rounded-lg ${item.color}`} />
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </span>
              );
            })}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {liveAudit.map((item, index) => (
            <motion.div
              key={item.title}
              className="flex gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3"
              animate={reduceMotion ? { opacity: 1 } : { borderColor: ['rgba(255,255,255,0.10)', 'rgba(37,211,102,0.32)', 'rgba(255,255,255,0.10)'] }}
              transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 3.2, delay: index * 0.46 }}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#25d366] text-sm font-black text-[#07100d]">
                {index + 1}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-white">{item.title}</p>
                <p className={`mt-1 text-xs font-semibold ${item.tone}`}>{item.meta}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <Link
          href="/login"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-black text-[#0d0f0e] transition hover:bg-[#d7ffe4]"
        >
          Abrir login
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </motion.div>
  );
}

export default function PublicHomePage() {
  const reduceMotion = useReducedMotion();

  return (
    <main className="min-h-screen overflow-hidden bg-[#0d0f0e] text-[#f2f6f3]">
      <section className="relative overflow-hidden px-4 pb-14 pt-5 sm:px-6 lg:min-h-[88svh] lg:px-8">
        <div aria-hidden="true" className="absolute inset-0">
          <Image
            src="/oguricap-login.png"
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-[0.18] grayscale"
            priority
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_24%,rgba(37,211,102,0.22),transparent_28%),linear-gradient(115deg,#0d0f0e_0%,rgba(13,15,14,0.96)_42%,rgba(13,15,14,0.66)_100%)]" />
          <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:42px_42px]" />
          
          <motion.div
            className="absolute -left-20 top-20 h-96 w-96 rounded-full bg-primary/22 blur-[120px]"
            animate={{ x: [0, 40, 0], y: [0, 30, 0], opacity: [0.15, 0.35, 0.15] }}
            transition={{ repeat: Infinity, duration: 12, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -right-20 bottom-20 h-[500px] w-[500px] rounded-full bg-secondary/18 blur-[140px]"
            animate={{ x: [0, -30, 0], y: [0, -40, 0], opacity: [0.12, 0.3, 0.12] }}
            transition={{ repeat: Infinity, duration: 15, ease: 'easeInOut', delay: 1 }}
          />

          <motion.div
            className="absolute inset-x-[-20%] top-[18%] h-px bg-gradient-to-r from-transparent via-[#2dd4bf]/90 to-transparent"
            animate={reduceMotion ? { opacity: 0.45 } : { x: ['-16%', '16%', '-16%'], opacity: [0.16, 0.84, 0.16] }}
            transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 6.4, ease: 'easeInOut' }}
          />
          <FloatingSignal className="left-0 top-[42%] w-full" delay={0.4} />
          <FloatingSignal className="left-0 top-[68%] w-full" delay={1.1} />
        </div>

        <FloatingCommandCloud />

        <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.055] px-3 py-2 backdrop-blur-md">
            <Image
              src="/oguricap-avatar.png"
              alt="OguriCap-Bot"
              width={36}
              height={36}
              className="h-9 w-9 rounded-lg object-cover"
              priority
            />
            <span className="text-sm font-black text-white">OguriCap-Bot</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-white/72 md:flex">
            <a href="#funciones" className="transition-colors hover:text-white">Funciones</a>
            <a href="#comandos" className="transition-colors hover:text-white">Comandos</a>
            <a href="#panel" className="transition-colors hover:text-white">Panel</a>
          </nav>

          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#25d366] px-5 py-2.5 text-sm font-black text-[#07100d] shadow-[0_0_15px_rgba(37,211,102,0.4)] transition-all hover:scale-105 hover:bg-[#7bed9f]"
          >
            Login
            <ArrowRight className="h-4 w-4" />
          </Link>
        </header>

        <div className="relative z-10 mx-auto max-w-7xl pt-16 sm:pt-20 lg:min-h-[64svh] lg:pt-24">
          <LiveBotConsole />

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="max-w-3xl lg:max-w-[37rem] xl:max-w-3xl"
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-[#25d366]/30 bg-[#25d366]/10 px-3 py-2 text-sm font-bold text-[#a7f3c7]">
              <motion.span
                className="h-2 w-2 rounded-lg bg-[#25d366]"
                animate={reduceMotion ? { opacity: 1 } : { scale: [1, 1.8, 1], opacity: [0.5, 1, 0.5] }}
                transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 1.3 }}
              />
              Bot de WhatsApp para comunidad
            </div>

            <h1 className="max-w-3xl text-4xl font-black leading-[1.08] text-white sm:text-5xl lg:text-6xl">
              OguriCap-Bot mueve tus grupos con <span className="bg-gradient-to-r from-[#25d366] to-[#2dd4bf] bg-clip-text text-transparent">comandos, juegos y control</span> en vivo.
            </h1>

            <p className="mt-6 max-w-2xl text-base font-medium leading-7 text-white/74 sm:text-lg">
              Gestiona grupos, crea stickers, descarga contenido, juega RPG, usa gacha, conecta SubBots y revisa todo desde un panel privado.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25d366] px-6 py-3.5 text-sm font-black text-[#07100d] shadow-[0_0_20px_rgba(37,211,102,0.3)] transition-all duration-300 hover:scale-105 hover:bg-[#7bed9f] hover:shadow-[0_0_35px_rgba(37,211,102,0.6)] active:scale-95"
              >
                Entrar al panel
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#funciones"
                className="group inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.03] px-6 py-3.5 text-sm font-black text-white backdrop-blur-sm transition-all duration-300 hover:border-[#2dd4bf]/60 hover:bg-white/[0.08] hover:shadow-[0_0_20px_rgba(45,212,191,0.2)] active:scale-95"
              >
                Ver lo que ofrece
              </a>
            </div>
          </motion.div>

          <div className="mt-10 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4 lg:max-w-[37rem] xl:max-w-3xl">
            {[
              ['100+', 'comandos'],
              ['24/7', 'actividad'],
              ['Multi', 'SubBots'],
              ['Live', 'panel'],
            ].map(([value, label], index) => (
              <motion.div
                key={label}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.08 }}
                whileHover={reduceMotion ? undefined : { y: -6, scale: 1.05, borderColor: 'rgba(37,211,102,0.6)' }}
                className="glass-card group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-lg backdrop-blur-md transition-all"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#25d366]/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <p className="relative z-10 text-3xl font-black text-white transition-colors duration-300 group-hover:text-[#25d366]">{value}</p>
                <p className="relative z-10 mt-1 text-sm font-bold text-white/60">{label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <CommandTicker />

      <section id="funciones" className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
            <div>
              <p className="mb-3 text-sm font-black text-[#25d366]">Funciones</p>
              <h2 className="text-3xl font-black leading-tight text-white sm:text-4xl">Lo que ofrece OguriCap-Bot</h2>
              <p className="mt-4 text-base leading-7 text-white/66">
                Modulos para mover comunidades, automatizar tareas repetidas y mantener visible lo que pasa en el bot.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {featureGroups.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.article
                    key={feature.title}
                    initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.96 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ delay: index * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={reduceMotion ? undefined : { y: -8, scale: 1.02, backgroundColor: 'rgba(255,255,255,0.02)' }}
                    className="group relative overflow-hidden rounded-[32px] border border-white/10 bg-[#141816]/60 p-7 shadow-[0_18px_60px_rgba(0,0,0,0.32)] backdrop-blur-xl transition-all duration-500 hover:border-[#2dd4bf]/40 hover:shadow-[0_0_40px_rgba(45,212,191,0.15)]"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                    <motion.div
                      aria-hidden="true"
                      className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${feature.pulse}`}
                      animate={reduceMotion ? { opacity: 0.7 } : { x: ['-100%', '100%'], opacity: [0.2, 0.95, 0.2] }}
                      transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 3.6, delay: index * 0.22, ease: 'easeInOut' }}
                    />
                    <div className="relative z-10">
                      <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 ${feature.accent}`}>
                        <Icon className="h-7 w-7" />
                      </div>
                      <h3 className="text-xl font-black text-white">{feature.title}</h3>
                      <p className="mt-3 text-sm leading-relaxed text-white/62">{feature.description}</p>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="comandos" className="border-y border-white/10 bg-[#121411] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-start">
          <div>
            <p className="mb-3 text-sm font-black text-[#ff4d8d]">Comandos</p>
            <h2 className="text-3xl font-black leading-tight text-white sm:text-4xl">Categorias listas para usar en WhatsApp</h2>
            <p className="mt-4 text-base leading-7 text-white/66">
              El menu organiza grupo, juegos, gacha, multimedia y herramientas para que cada comando tenga un lugar claro.
            </p>
            <div className="mt-8">
              <ActivityPanel />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {commandCategories.map((category, index) => (
              <motion.div
                key={category.title}
                initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ delay: index * 0.06 }}
                className="rounded-lg border border-white/10 bg-[#0d0f0e] p-5"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className={`text-base font-black ${category.color}`}>{category.title}</h3>
                  <motion.span
                    className="h-2 w-2 rounded-lg bg-current"
                    animate={reduceMotion ? { opacity: 0.7 } : { scale: [1, 1.7, 1], opacity: [0.35, 1, 0.35] }}
                    transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 1.5, delay: index * 0.2 }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {category.commands.map((command, commandIndex) => (
                    <motion.span
                      key={command}
                      className="rounded-lg border border-white/10 bg-white/[0.045] px-3 py-2 font-mono text-xs font-bold text-[#c7f9d8]"
                      whileHover={reduceMotion ? undefined : { y: -3, scale: 1.03 }}
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.3 }}
                      transition={{ delay: commandIndex * 0.025 }}
                    >
                      {command}
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <CommandTicker reverse />

      <section id="panel" className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="mb-3 text-sm font-black text-[#2dd4bf]">Panel privado</p>
              <h2 className="text-3xl font-black leading-tight text-white sm:text-4xl">Control operativo despues del login</h2>
              <p className="mt-4 text-base leading-7 text-white/66">
                Estado del bot principal, subbots, grupos, aportes, recursos, logs y alertas para administrar sin entrar al servidor.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {panelHighlights.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={item.label}
                      className="rounded-lg border border-white/10 bg-[#141816] p-4"
                      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.25 }}
                      transition={{ delay: index * 0.04 }}
                      whileHover={reduceMotion ? undefined : { y: -4 }}
                    >
                      <Icon className={`mb-3 h-5 w-5 ${item.tone}`} />
                      <p className="font-black text-white">{item.label}</p>
                      <p className="mt-1 text-sm text-white/60">{item.value}</p>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <PanelControlPreview />
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <motion.div
          className="mx-auto max-w-7xl overflow-hidden rounded-2xl border border-[#25d366]/40 bg-gradient-to-br from-[#25d366] to-[#2dd4bf] p-6 text-[#07100d] shadow-[0_0_60px_rgba(37,211,102,0.3)] sm:p-10"
          whileInView={reduceMotion ? undefined : { y: [0, -6, 0] }}
          viewport={{ once: true, amount: 0.3 }}
          transition={reduceMotion ? { duration: 0.12 } : { duration: 0.8 }}
        >
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-2xl font-black sm:text-3xl">OguriCap-Bot listo para operar.</h2>
              <p className="mt-2 max-w-2xl text-sm font-semibold text-[#07100d]/72">
                Entra al panel para conectar, sincronizar, revisar actividad y administrar modulos.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#07100d] px-6 py-3.5 text-sm font-black text-white shadow-xl transition-all hover:scale-105 hover:bg-[#1b241f]"
            >
              Login
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.div>
      </section>

      <footer className="border-t border-white/10 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-white/54 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 OguriCap-Bot</p>
          <div className="flex flex-wrap gap-4">
            <span className="inline-flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#25d366]" /> WhatsApp</span>
            <span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#ff4d8d]" /> Comunidad</span>
            <span className="inline-flex items-center gap-2"><Download className="h-4 w-4 text-[#2dd4bf]" /> Multimedia</span>
            <span className="inline-flex items-center gap-2"><Send className="h-4 w-4 text-[#f59e0b]" /> Panel</span>
            <span className="inline-flex items-center gap-2"><Zap className="h-4 w-4 text-[#a3e635]" /> SubBots</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
