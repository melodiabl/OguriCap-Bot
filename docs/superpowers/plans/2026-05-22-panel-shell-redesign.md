# Panel Shell Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar el shell del panel (sidebar, header, layout, tokens) al estilo Dashboard Pro — Zinc-950 base + `#25d366` acento único.

**Architecture:** Shell-first: primero se actualizan los tokens en `tailwind.config.ts` y `globals.css`, luego se reescriben `Sidebar.tsx` y `Header.tsx`, y finalmente se ajustan los componentes UI (`Card`, `Button`, `Badge`). Cada tarea es independiente y produce cambios visibles en el panel.

**Tech Stack:** Next.js 14, Tailwind CSS v3, Framer Motion, Lucide React, TypeScript

---

## File Map

| Archivo | Cambio |
|---|---|
| `frontend-next/tailwind.config.ts` | Agregar tokens Zinc, accent system |
| `frontend-next/src/app/globals.css` | Nuevas CSS variables Zinc + acento |
| `frontend-next/src/components/layout/Sidebar.tsx` | Rediseño completo — expandido con labels |
| `frontend-next/src/components/layout/Header.tsx` | Rediseño — breadcrumb + buscador ghost + notif |
| `frontend-next/src/components/layout/MainLayout.tsx` | Ajuste de padding y sidebar offset |
| `frontend-next/src/components/ui/Card.tsx` | Superficie Zinc, sin glassmorphism |
| `frontend-next/src/components/ui/Button.tsx` | Variantes con tokens Zinc |
| `frontend-next/src/components/ui/Badge.tsx` | Accent + semánticos únicamente |

---

## Task 1: Design Tokens — Zinc palette + accent system

**Files:**
- Modify: `frontend-next/tailwind.config.ts`
- Modify: `frontend-next/src/app/globals.css`

- [ ] **Step 1: Agregar tokens Zinc y accent en tailwind.config.ts**

En `tailwind.config.ts`, dentro de `theme.extend.colors`, agregar después del bloque `accent` existente:

```ts
// Zinc neutral palette (Dashboard Pro base)
zinc: {
  50:  '#fafafa',
  100: '#f4f4f5',
  200: '#e4e4e7',
  300: '#d4d4d8',
  400: '#a1a1aa',
  500: '#71717a',
  600: '#52525b',
  700: '#3f3f46',
  800: '#27272a',
  900: '#18181b',
  950: '#09090b',
},
// Single accent — green WhatsApp
'pro-accent': {
  DEFAULT: '#25d366',
  subtle:  'rgba(37,211,102,0.15)',
  ghost:   'rgba(37,211,102,0.08)',
  border:  'rgba(37,211,102,0.25)',
  glow:    '0 0 14px rgba(37,211,102,0.25)',
},
// Semantic states (solo para alertas/estados, sin protagonismo visual)
semantic: {
  danger:  '#f43f5e',
  warning: '#f59e0b',
  info:    '#38bdf8',
  success: '#25d366',
},
```

- [ ] **Step 2: Agregar CSS variables Zinc en globals.css**

Al inicio del bloque `:root` en `frontend-next/src/app/globals.css`, agregar después de la línea `--bg-0: 8 10 9;`:

```css
/* Dashboard Pro — Zinc tokens */
--pro-base:     9 9 11;      /* zinc-950 */
--pro-surface:  12 12 14;    /* zinc-900 approx */
--pro-elevated: 24 24 27;    /* zinc-800 */
--pro-border:   39 39 42;    /* zinc-700 */
--pro-muted:    113 113 122; /* zinc-500 */
--pro-ghost:    63 63 70;    /* zinc-700 */
--pro-text:     250 250 250; /* zinc-50 */
--pro-accent:   37 211 102;  /* #25d366 */
```

- [ ] **Step 3: Verificar que compila sin errores**

```bash
cd frontend-next && npx tsc --noEmit 2>&1 | head -20
```

Expected: sin errores de tipos (los tokens son strings, no afectan TypeScript).

- [ ] **Step 4: Commit**

```bash
git add frontend-next/tailwind.config.ts frontend-next/src/app/globals.css
git commit -m "feat(design): add zinc token system + pro-accent for shell redesign"
```

---

## Task 2: Sidebar — Dashboard Pro expandido con labels

**Files:**
- Modify: `frontend-next/src/components/layout/Sidebar.tsx`

El sidebar actual usa icon-only con glassmorphism. El nuevo tiene:
- Ancho `w-64` (256px) — visible siempre en `lg+`, drawer en mobile
- Header de marca: ícono verde + "OguriCap Bot" + versión
- Secciones con labels (`CONTROL CENTRAL`, `COMUNIDAD`, etc.)
- Items: icono + texto + badge opcional
- Item activo: `bg-zinc-800` texto blanco
- Footer: avatar + nombre + rol + logout

- [ ] **Step 1: Reemplazar el contenido completo de Sidebar.tsx**

```tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, ChevronDown } from 'lucide-react';

import { ProfileAvatar } from '@/components/user/ProfileAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { useBotGlobalState } from '@/contexts/BotGlobalStateContext';
import { useGlobalUpdate } from '@/contexts/GlobalUpdateContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useSocketBotStatus } from '@/contexts/SocketContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useBotStatus } from '@/hooks/useRealTime';
import { NAV_ITEMS, NAV_SECTIONS, type NavSectionKey } from '@/lib/navigation';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const SECTION_BADGE_KEYS: Partial<Record<NavSectionKey, string[]>> = {
  control:   ['subbots'],
  community: [],
  operations: ['pedidos'],
  intelligence: ['alertas'],
};

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { hasPermission } = usePermissions();
  const { isConnected: pollingConnected, isConnecting } = useBotStatus();
  const botStatus = useSocketBotStatus();
  const { unreadCount } = useNotifications();
  const { isGloballyOn } = useBotGlobalState();
  const { dashboardStats, botStatus: globalBotStatus } = useGlobalUpdate();
  const [collapsed, setCollapsed] = useState<Set<NavSectionKey>>(new Set());

  const isConnected = botStatus?.connected ?? globalBotStatus?.connected ?? pollingConnected;

  const allowedItems = NAV_ITEMS.filter((item) => hasPermission(item.pageKey));
  const sections = NAV_SECTIONS.map((sec) => ({
    ...sec,
    items: allowedItems.filter((i) => i.section === sec.key),
  })).filter((sec) => sec.items.length > 0);

  const toggleSection = (key: NavSectionKey) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const getBadge = (path: string): number | null => {
    if (path === '/subbots') return dashboardStats?.subbots?.total ?? null;
    if (path === '/pedidos') return dashboardStats?.pedidosPendientes ?? null;
    if (path === '/alertas') return unreadCount > 0 ? unreadCount : null;
    return null;
  };

  const botDot = !isGloballyOn ? 'bg-zinc-600' : isConnecting ? 'bg-amber-400' : isConnected ? 'bg-[#25d366]' : 'bg-red-500';

  const SidebarContent = (
    <div className="relative flex h-full flex-col bg-[#0c0c0e] border-r border-[#27272a]">
      {/* Brand header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[#27272a]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#25d366] text-black font-black text-sm flex-shrink-0">
          O
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-zinc-50 leading-none truncate">OguriCap Bot</div>
          <div className="text-[10px] text-zinc-600 mt-0.5 font-medium">v1.8.2 · {user?.rol || 'admin'}</div>
        </div>
        {/* Bot status dot */}
        <div className={cn('ml-auto w-2 h-2 rounded-full flex-shrink-0', botDot)} />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {sections.map((section) => {
          const isCollapsed = collapsed.has(section.key);
          return (
            <div key={section.key} className="mb-1">
              <button
                onClick={() => toggleSection(section.key)}
                className="flex w-full items-center justify-between px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                {section.label}
                <ChevronDown
                  className={cn('h-3 w-3 transition-transform text-zinc-700', isCollapsed && '-rotate-90')}
                />
              </button>

              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    {section.items.map((item) => {
                      const isActive = pathname === item.path;
                      const badge = getBadge(item.path);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.path}
                          href={item.path}
                          onClick={onClose}
                          className={cn(
                            'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-100 group',
                            isActive
                              ? 'bg-[#27272a] text-zinc-50 font-semibold'
                              : 'text-zinc-500 hover:bg-[#18181b] hover:text-zinc-300'
                          )}
                        >
                          <Icon
                            className={cn(
                              'h-4 w-4 flex-shrink-0',
                              isActive ? 'text-[#25d366]' : 'text-zinc-600 group-hover:text-zinc-400'
                            )}
                          />
                          <span className="flex-1 truncate">{item.label}</span>
                          {badge !== null && badge > 0 && (
                            <span className={cn(
                              'text-[10px] font-bold px-1.5 py-0.5 rounded',
                              item.path === '/alertas'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-[#25d366]/15 text-[#25d366]'
                            )}>
                              {badge > 99 ? '99+' : badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-[#27272a] px-3 py-3">
        <div className="flex items-center gap-2.5">
          <ProfileAvatar size="sm" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-zinc-200 truncate">{user?.username || 'Usuario'}</div>
            <div className="text-[10px] text-zinc-600 uppercase tracking-wider truncate">{user?.rol || 'usuario'}</div>
          </div>
          <button
            onClick={() => logout()}
            className="p-1.5 rounded text-zinc-600 hover:text-zinc-300 hover:bg-[#27272a] transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-[100dvh] w-64 transition-transform duration-300 ease-out lg:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {SidebarContent}
      </aside>

      {/* Desktop fixed sidebar */}
      <aside className="hidden lg:flex lg:fixed lg:left-0 lg:top-0 lg:h-[100dvh] lg:w-64 lg:z-30">
        {SidebarContent}
      </aside>
    </>
  );
};
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd frontend-next && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errores. Si aparece algún error de tipo en `dashboardStats.subbots.total` o `dashboardStats.pedidosPendientes`, reemplazar esos accesos por `null` (son opcionales).

- [ ] **Step 3: Actualizar el offset del sidebar en MainLayout.tsx**

El sidebar ahora es `w-64` (256px). Cambiar en `MainLayout.tsx` línea 44:

```tsx
// Antes:
<div className="flex-1 flex flex-col relative z-10 w-full min-w-0 lg:pl-72 h-[100dvh] overflow-hidden">

// Después:
<div className="flex-1 flex flex-col relative z-10 w-full min-w-0 lg:pl-64 h-[100dvh] overflow-hidden">
```

- [ ] **Step 4: Commit**

```bash
git add frontend-next/src/components/layout/Sidebar.tsx frontend-next/src/components/layout/MainLayout.tsx
git commit -m "feat(sidebar): dashboard pro redesign — expanded labels, zinc palette, user footer"
```

---

## Task 3: Header — breadcrumb + ghost search + notificaciones

**Files:**
- Modify: `frontend-next/src/components/layout/Header.tsx`

El header actual es complejo con zona, efectos, theme toggle, diagnostics. El nuevo es limpio: breadcrumb izquierda + acciones derechas (search ghost + bell).

- [ ] **Step 1: Reemplazar Header.tsx**

```tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { Bell, Menu, Search, X } from 'lucide-react';

import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { NAV_ITEMS, NAV_SECTIONS } from '@/lib/navigation';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onMenuClick: () => void;
  sidebarOpen: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, sidebarOpen }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const { unreadCount, isOpen, setIsOpen, toggleOpen } = useNotifications();
  const reduceMotion = useReducedMotion();

  const currentPage = NAV_ITEMS.find((item) => item.path === pathname);
  const currentSection = NAV_SECTIONS.find((s) => s.key === currentPage?.section);

  return (
    <header className="sticky top-0 z-50 h-11 w-full flex items-center border-b border-[#27272a] bg-[#0c0c0e] px-4 flex-shrink-0">
      {/* Mobile menu button */}
      <div className="lg:hidden mr-3">
        <button
          onClick={onMenuClick}
          className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-[#27272a] transition-colors"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm flex-1 min-w-0">
        {currentSection && (
          <>
            <span className="text-zinc-600 truncate hidden sm:inline">{currentSection.label}</span>
            <span className="text-zinc-700 hidden sm:inline">/</span>
          </>
        )}
        <span className="font-semibold text-zinc-200 truncate">
          {currentPage?.headerLabel || currentPage?.label || 'Panel'}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Ghost search */}
        <div className="hidden sm:flex items-center gap-2 h-7 px-3 rounded border border-[#27272a] bg-[#18181b] text-zinc-600 text-xs cursor-default">
          <Search className="h-3 w-3" />
          <span>Buscar...</span>
          <kbd className="text-[10px] bg-[#27272a] px-1 rounded font-mono">⌘K</kbd>
        </div>

        {/* Notifications */}
        <div className="relative">
          <Tooltip content="Notificaciones" side="bottom">
            <button
              ref={buttonRef}
              onClick={toggleOpen}
              className={cn(
                'relative flex items-center justify-center h-7 w-7 rounded border transition-colors',
                unreadCount > 0
                  ? 'border-[#25d366]/30 bg-[#25d366]/10 text-[#25d366]'
                  : 'border-[#27272a] bg-transparent text-zinc-500 hover:bg-[#18181b] hover:text-zinc-300'
              )}
            >
              <motion.div
                animate={
                  !reduceMotion && unreadCount > 0
                    ? { rotate: [0, -10, 10, -6, 6, 0] }
                    : { rotate: 0 }
                }
                transition={
                  !reduceMotion && unreadCount > 0
                    ? { duration: 0.6, ease: 'easeOut', repeat: Infinity, repeatDelay: 4 }
                    : undefined
                }
              >
                <Bell className="h-4 w-4" />
              </motion.div>
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#25d366] px-1 text-[9px] font-bold text-black"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </motion.span>
              )}
            </button>
          </Tooltip>

          <NotificationDropdown isOpen={isOpen} onClose={() => setIsOpen(false)} buttonRef={buttonRef} />
        </div>
      </div>
    </header>
  );
};
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd frontend-next && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errores. El nuevo Header elimina las importaciones de `useTheme`, `useDevicePerformance`, `useOguriTheme`, `DiagnosticsPanelButton`, `ProfileAvatar` — si alguna otra parte del codebase usa estas features solo a través del Header, verificar que sigan funcionando por sus propios contexts.

- [ ] **Step 3: Verificar build**

```bash
cd frontend-next && npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` o similar. Si hay errores de imports no usados, removerlos del Header.

- [ ] **Step 4: Commit**

```bash
git add frontend-next/src/components/layout/Header.tsx
git commit -m "feat(header): dashboard pro redesign — breadcrumb, ghost search, zinc palette"
```

---

## Task 4: Card components — superficie Zinc

**Files:**
- Modify: `frontend-next/src/components/ui/Card.tsx`

- [ ] **Step 1: Leer el archivo actual**

```bash
cat frontend-next/src/components/ui/Card.tsx
```

- [ ] **Step 2: Localizar y reemplazar los fondos glassmorphism**

En `Card.tsx`, buscar todos los `className` que contengan `glass-card`, `backdrop-blur`, `bg-card/`, `border-white/` y reemplazarlos por la superficie Zinc:

```tsx
// Antes (ejemplo típico):
className="glass-card p-6"

// Después:
className="rounded-xl bg-[#18181b] border border-[#27272a] p-6"
```

Para `StatCard` específicamente, el patrón es:
```tsx
// Fondo de card
bg-[#0c0c0e] border border-[#27272a] rounded-xl

// Hover
hover:border-[#3f3f46] hover:bg-[#18181b] transition-colors duration-150

// Value grande (número principal)
text-zinc-50 font-bold

// Subtitle/label
text-zinc-500 text-sm

// Ícono con color accent
text-[#25d366]  // solo si el color original era primary/success
text-zinc-500   // para iconos neutros
```

- [ ] **Step 3: Verificar build**

```bash
cd frontend-next && npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add frontend-next/src/components/ui/Card.tsx
git commit -m "feat(card): zinc surface — replace glassmorphism with pro palette"
```

---

## Task 5: UI Primitives — Button, Badge, StatusBadge

**Files:**
- Modify: `frontend-next/src/components/ui/Button.tsx`
- Modify: `frontend-next/src/components/ui/Badge.tsx`
- Modify: `frontend-next/src/components/ui/StatusBadge.tsx`

- [ ] **Step 1: Leer los tres archivos**

```bash
cat frontend-next/src/components/ui/Button.tsx
cat frontend-next/src/components/ui/Badge.tsx
cat frontend-next/src/components/ui/StatusBadge.tsx
```

- [ ] **Step 2: Actualizar Button — variante primary**

En `Button.tsx`, la variante `primary` (o `default`):

```tsx
// Variante primary — único botón de acción principal
primary: 'bg-[#25d366] text-black font-semibold hover:bg-[#22c55e] active:scale-95 transition-all',

// Variante secondary / ghost
secondary: 'bg-[#18181b] text-zinc-200 border border-[#27272a] hover:bg-[#27272a] hover:text-zinc-50 transition-colors',

// Variante ghost
ghost: 'text-zinc-400 hover:bg-[#18181b] hover:text-zinc-200 transition-colors',

// Variante danger
danger: 'bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors',
```

- [ ] **Step 3: Actualizar Badge — sistema semántico limpio**

En `Badge.tsx`, reemplazar los estilos de variantes por:

```tsx
const variantStyles = {
  default: 'bg-[#27272a] text-zinc-300 border border-[#3f3f46]',
  success: 'bg-[#25d366]/15 text-[#25d366] border border-[#25d366]/25',
  warning: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  danger:  'bg-red-500/15 text-red-400 border border-red-500/25',
  info:    'bg-sky-500/15 text-sky-400 border border-sky-500/25',
  primary: 'bg-[#25d366]/15 text-[#25d366] border border-[#25d366]/25',
};
```

- [ ] **Step 4: Actualizar StatusBadge — tone system**

En `StatusBadge.tsx`, el sistema de `tone` actual usa colores oguri-*. Reemplazar por:

```tsx
const toneStyles = {
  success: 'bg-[#25d366]/15 text-[#25d366] border-[#25d366]/25',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  danger:  'bg-red-500/15 text-red-400 border-red-500/25',
  info:    'bg-sky-500/15 text-sky-400 border-sky-500/25',
  neutral: 'bg-[#27272a] text-zinc-500 border-[#3f3f46]',
};
```

- [ ] **Step 5: Verificar build completo**

```bash
cd frontend-next && npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled` sin errores. Warnings de lint son aceptables.

- [ ] **Step 6: Commit final**

```bash
git add frontend-next/src/components/ui/Button.tsx \
        frontend-next/src/components/ui/Badge.tsx \
        frontend-next/src/components/ui/StatusBadge.tsx
git commit -m "feat(ui): zinc-aligned primitives — button, badge, status-badge"
```

---

## Verificación final

Después de los 5 tasks:

- [ ] `npm run build` pasa sin errores
- [ ] Sidebar muestra secciones con labels y texto en todos los items
- [ ] Header muestra breadcrumb `Sección / Página` en desktop
- [ ] Notificaciones funcionan (bell badge verde cuando hay no leídas)
- [ ] Mobile: drawer del sidebar abre y cierra correctamente
- [ ] Bot status dot en sidebar refleja estado real (verde/rojo/amber)
- [ ] Badges de pedidos/alertas/subbots aparecen cuando `count > 0`
- [ ] Ningún componente muestra `oguri-purple`, `oguri-cyan` como color principal de fondo (solo semánticos permitidos)
