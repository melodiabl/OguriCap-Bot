'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
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
  PlayCircle,
  Command
} from 'lucide-react';

const featureGroups = [
  {
    title: 'Comunidad activa',
    description: 'Bienvenida, menciones, reglas, admins, warns, tagall, hidetag y control de actividad.',
    icon: Users,
    color: 'text-[#25d366]',
    bg: 'bg-[#25d366]/10',
    border: 'group-hover:border-[#25d366]/50',
    shadow: 'group-hover:shadow-[0_0_30px_rgba(37,211,102,0.15)]',
  },
  {
    title: 'Diversión y juegos',
    description: 'RPG, economía, casino, ruleta, minas, aventura, perfiles, niveles y rankings.',
    icon: Gamepad2,
    color: 'text-[#ff4d8d]',
    bg: 'bg-[#ff4d8d]/10',
    border: 'group-hover:border-[#ff4d8d]/50',
    shadow: 'group-hover:shadow-[0_0_30px_rgba(255,77,141,0.15)]',
  },
  {
    title: 'Gacha y waifus',
    description: 'Rolls, claims, harem, trades, rarezas, top waifus y colección viva por usuario.',
    icon: Sparkles,
    color: 'text-[#f59e0b]',
    bg: 'bg-[#f59e0b]/10',
    border: 'group-hover:border-[#f59e0b]/50',
    shadow: 'group-hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]',
  },
  {
    title: 'Multimedia rápida',
    description: 'Stickers, imagen a sticker, música, descargas, letras, búsquedas y contenido compartido.',
    icon: ImageIcon,
    color: 'text-[#2dd4bf]',
    bg: 'bg-[#2dd4bf]/10',
    border: 'group-hover:border-[#2dd4bf]/50',
    shadow: 'group-hover:shadow-[0_0_30px_rgba(45,212,191,0.15)]',
  },
  {
    title: 'Herramientas útiles',
    description: 'Traductor, Wikipedia, Google, IP lookup, screenshots web, QR, uploader y utilidades.',
    icon: Terminal,
    color: 'text-[#a3e635]',
    bg: 'bg-[#a3e635]/10',
    border: 'group-hover:border-[#a3e635]/50',
    shadow: 'group-hover:shadow-[0_0_30px_rgba(163,230,53,0.15)]',
  },
  {
    title: 'SubBots y panel',
    description: 'Instancias separadas, estado del bot, grupos, aportes, recursos, logs y alertas.',
    icon: Bot,
    color: 'text-[#7dd3fc]',
    bg: 'bg-[#7dd3fc]/10',
    border: 'group-hover:border-[#7dd3fc]/50',
    shadow: 'group-hover:shadow-[0_0_30px_rgba(125,211,252,0.15)]',
  },
];

const stats = [
  { value: '100+', label: 'Comandos' },
  { value: '24/7', label: 'Actividad' },
  { value: 'Multi', label: 'SubBots' },
  { value: 'Live', label: 'Panel' },
];

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-50px" },
  transition: { duration: 0.5, ease: "easeOut" }
};

const staggerContainer = {
  initial: { opacity: 0 },
  whileInView: { opacity: 1 },
  viewport: { once: true, margin: "-50px" },
  transition: { staggerChildren: 0.1 }
};

export default function Home() {
  return (
    <main className="min-h-screen bg-[#060807] text-[#f2f6f3] selection:bg-[#25d366]/30">
      {/* Navbar Premium */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.05] bg-[#060807]/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 transition-transform hover:scale-105">
            <div className="relative h-9 w-9 overflow-hidden rounded-xl border border-white/10 shadow-[0_0_15px_rgba(37,211,102,0.2)]">
              <Image src="/oguricap-avatar.png" alt="Logo" fill className="object-cover" />
            </div>
            <span className="font-bold tracking-tight text-white">OguriCap<span className="text-[#25d366]">-Bot</span></span>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm font-medium text-white/60 transition-colors hover:text-white">Características</a>
            <a href="#commands" className="text-sm font-medium text-white/60 transition-colors hover:text-white">Comandos</a>
            <Link 
              href="/login" 
              className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-white/5 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-white/10 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95 border border-white/10"
            >
              <span>Panel de Control</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden pt-16">
        {/* CSS-only optimized background effects */}
        <div className="absolute inset-0 z-0">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#25d366]/10 blur-[120px] rounded-full opacity-50" />
          <div className="absolute left-[20%] top-[20%] w-[400px] h-[400px] bg-[#2dd4bf]/10 blur-[100px] rounded-full opacity-40" />
          <div className="absolute right-[20%] bottom-[20%] w-[500px] h-[500px] bg-[#ff4d8d]/10 blur-[100px] rounded-full opacity-40" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_10%,transparent_100%)]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-[#25d366]/30 bg-[#25d366]/10 px-4 py-1.5 text-sm font-semibold text-[#a7f3c7] backdrop-blur-md"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#25d366] opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#25d366]"></span>
              </span>
              Sistema Operativo y Estable
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mx-auto max-w-4xl text-5xl font-black tracking-tight text-white sm:text-7xl lg:text-8xl"
            >
              Potencia tu grupo de <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-[#25d366] via-[#2dd4bf] to-[#25d366] bg-clip-text text-transparent bg-[length:200%_auto] animate-shimmer">
                WhatsApp al máximo
              </span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mx-auto mt-6 max-w-2xl text-lg text-white/60 sm:text-xl leading-relaxed"
            >
              OguriCap-Bot automatiza tareas, divierte a tus usuarios con juegos RPG y Gacha, proporciona descargas multimedia y mucho más, todo en tiempo real.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <Link
                href="/login"
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-[#25d366] to-[#20b858] px-8 py-4 text-base font-bold text-black shadow-[0_0_40px_rgba(37,211,102,0.3)] transition-all hover:scale-105 hover:shadow-[0_0_60px_rgba(37,211,102,0.5)] active:scale-95 sm:w-auto"
              >
                <span>Acceder al Dashboard</span>
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#features"
                className="group flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-8 py-4 text-base font-bold text-white backdrop-blur-md transition-all hover:bg-white/10 hover:shadow-[0_0_30px_rgba(255,255,255,0.05)] active:scale-95 sm:w-auto"
              >
                <Command className="h-5 w-5 opacity-70 transition-opacity group-hover:opacity-100" />
                <span>Explorar funciones</span>
              </a>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mx-auto mt-20 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4"
          >
            {stats.map((stat, i) => (
              <div key={i} className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center backdrop-blur-sm transition-all hover:border-white/10 hover:bg-white/[0.04]">
                <div className="text-3xl font-black text-white transition-transform group-hover:-translate-y-1 group-hover:text-[#25d366]">{stat.value}</div>
                <div className="mt-1 text-sm font-medium text-white/50">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div 
            {...fadeIn}
            className="mx-auto max-w-2xl text-center"
          >
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#25d366]">Características Premium</h2>
            <p className="mt-2 text-3xl font-black tracking-tight text-white sm:text-5xl">Todo lo que necesitas en un solo bot</p>
            <p className="mt-4 text-lg text-white/60">Diseñado para alto rendimiento y máxima diversión en tus grupos.</p>
          </motion.div>

          <motion.div 
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {featureGroups.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={i}
                  variants={fadeIn}
                  className={`group relative overflow-hidden rounded-3xl border border-white/5 bg-[#0a0d0b] p-8 transition-all duration-300 hover:-translate-y-2 ${feature.border} ${feature.shadow}`}
                >
                  <div className={`mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl ${feature.bg} ${feature.color} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="mb-3 text-xl font-bold text-white">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-white/60">{feature.description}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Live Preview / Panel Teaser */}
      <section id="commands" className="relative overflow-hidden py-24 sm:py-32 bg-[#080b09]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(37,211,102,0.05),transparent_50%)]" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
            <motion.div {...fadeIn}>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#2dd4bf]/10 px-4 py-1.5 text-sm font-semibold text-[#2dd4bf]">
                <Radio className="h-4 w-4" /> Centro de Control en Vivo
              </div>
              <h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
                Administra sin escribir código.
              </h2>
              <p className="mt-6 text-lg text-white/60 leading-relaxed">
                El panel de OguriCap te permite gestionar SubBots, grupos, recursos del servidor y revisar logs en tiempo real con una interfaz moderna, ultra rápida y sin cuelgues.
              </p>

              <ul className="mt-8 space-y-4">
                {[
                  'Monitoreo de CPU y Memoria en vivo',
                  'Gestión de SubBots con QRs dinámicos',
                  'Logs y Alertas unificadas sin latencia',
                  'Diseño responsive y dark mode nativo'
                ].map((item, i) => (
                  <motion.li 
                    key={i} 
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-3 text-white/80"
                  >
                    <CheckCircle className="h-5 w-5 text-[#25d366]" />
                    <span>{item}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9, rotateY: 10 }}
              whileInView={{ opacity: 1, scale: 1, rotateY: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="relative rounded-2xl border border-white/10 bg-[#0d120f] shadow-[0_0_50px_rgba(37,211,102,0.1)] p-2 backdrop-blur-xl"
            >
              <div className="absolute inset-x-0 -top-px mx-auto h-px w-1/2 bg-gradient-to-r from-transparent via-[#25d366] to-transparent opacity-50" />
              <div className="rounded-xl border border-white/5 bg-[#060807] p-6">
                <div className="mb-6 flex items-center justify-between border-b border-white/5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-[#25d366]/20 p-2 text-[#25d366]">
                      <Server className="h-full w-full" />
                    </div>
                    <div>
                      <div className="font-bold text-white">Oguri Main Instance</div>
                      <div className="text-xs text-[#25d366]">Online • 24ms ping</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  {[
                    { label: 'CPU Usage', val: '12%', color: 'bg-[#25d366]' },
                    { label: 'Memory', val: '458 MB', color: 'bg-[#2dd4bf]' },
                    { label: 'Active Chats', val: '1,245', color: 'bg-[#ff4d8d]' }
                  ].map((stat, i) => (
                    <div key={i} className="flex flex-col gap-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/60">{stat.label}</span>
                        <span className="font-mono text-white">{stat.val}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                        <div className={`h-full rounded-full ${stat.color} opacity-80`} style={{ width: i === 0 ? '12%' : i === 1 ? '45%' : '78%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 sm:py-32 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
           <div className="h-[500px] w-[500px] bg-gradient-to-tr from-[#25d366] to-[#2dd4bf] rounded-full blur-[150px] opacity-20" />
        </div>
        <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div {...fadeIn}>
            <h2 className="text-4xl font-black text-white sm:text-5xl">¿Listo para mejorar tu comunidad?</h2>
            <p className="mt-6 text-xl text-white/60">Únete a cientos de grupos que ya disfrutan de OguriCap-Bot.</p>
            <div className="mt-10 flex justify-center gap-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-sm font-bold text-black shadow-xl transition-all hover:scale-105 hover:bg-gray-100"
              >
                Ingresar al Sistema
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#060807] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row text-sm text-white/40">
          <p>© {new Date().getFullYear()} OguriCap-Bot. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#25d366]" /> WhatsApp Ready</span>
            <span className="flex items-center gap-2"><Zap className="h-4 w-4 text-[#f59e0b]" /> High Performance</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
