import React from 'react';
import toast, { type ToastOptions } from 'react-hot-toast';
import { AlertCircle, CheckCircle, Info, AlertTriangle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type NotifyOptions = ToastOptions & {
  title?: string;
  dedupeKey?: string;
  dedupeMs?: number;
};

const recentToasts = new Map<string, { id: string; timestamp: number }>();

function normalizeNotifyPart(value?: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function buildNotifyKey(type: string, title: string | undefined, message: string, explicitKey?: string) {
  return explicitKey || `${type}|${normalizeNotifyPart(title)}|${normalizeNotifyPart(message)}`;
}

function cleanupRecentToasts(now = Date.now()) {
  for (const [key, value] of recentToasts.entries()) {
    if (now - value.timestamp > 30000) recentToasts.delete(key);
  }
}

function showDedupedToast(
  type: 'info' | 'success' | 'warning' | 'error' | 'system',
  defaultTitle: string,
  message: string,
  options?: NotifyOptions,
) {
  const dedupeMs = Math.max(500, Number(options?.dedupeMs || 5000));
  const title = options?.title || defaultTitle;
  const key = buildNotifyKey(type, title, message, options?.dedupeKey);
  const now = Date.now();

  cleanupRecentToasts(now);

  const existing = recentToasts.get(key);
  if (existing && now - existing.timestamp < dedupeMs) {
    return existing.id;
  }

  const toastId = `notify:${key}`;
  recentToasts.set(key, { id: toastId, timestamp: now });

  const { dedupeKey: _dedupeKey, dedupeMs: _dedupeMs, title: _title, ...toastOptions } = options || {};

  return toast.custom(
    (t) => (
      <div className={cn(t.visible ? 'animate-enter' : 'animate-leave')}>
        <CustomToast type={type} title={title} message={message} />
      </div>
    ),
    { id: toastId, ...toastOptions }
  );
}

const CustomToast = ({ 
  title, 
  message, 
  type 
}: { 
  title?: string; 
  message: string; 
  type: 'info' | 'success' | 'warning' | 'error' | 'system' 
}) => {
  const icons = {
    info: <Info className="w-5 h-5" />,
    success: <CheckCircle className="w-5 h-5" />,
    warning: <AlertTriangle className="w-5 h-5" />,
    error: <AlertCircle className="w-5 h-5" />,
    system: <Zap className="w-5 h-5" />,
  };

  return (
    <div className={cn('notif-toast', `notif-toast-${type}`)}>
      <div className="notif-icon-container">
        {icons[type]}
      </div>
      <div className="flex-1 min-w-0">
        {title && <span className="notif-toast-title">{title}</span>}
        <span className="notif-toast-message">{message}</span>
      </div>
    </div>
  );
};

export const notify = {
  success(message: string, options?: NotifyOptions) {
    return showDedupedToast('success', 'Éxito', message, { duration: 4000, ...options });
  },
  error(message: string, options?: NotifyOptions) {
    return showDedupedToast('error', 'Error', message, { duration: 6000, ...options });
  },
  warning(message: string, options?: NotifyOptions) {
    return showDedupedToast('warning', 'Atención', message, { duration: 5000, ...options });
  },
  info(message: string, options?: NotifyOptions) {
    return showDedupedToast('info', 'Información', message, { duration: 4000, ...options });
  },
  system(message: string, options?: NotifyOptions) {
    return showDedupedToast('system', 'Sistema', message, { duration: 5000, ...options });
  },
  dismiss(toastId?: string) {
    toast.dismiss(toastId);
  },
};
