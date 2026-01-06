import React from 'react';
import toast, { type ToastOptions } from 'react-hot-toast';
import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

type NotifyOptions = ToastOptions;

function toastClass(typeClass: string, options?: NotifyOptions) {
  return cn('toast-custom', typeClass, options?.className);
}

export const notify = {
  success(message: string, options?: NotifyOptions) {
    return toast.success(message, { ...options, className: toastClass('toast-success', options) });
  },
  error(message: string, options?: NotifyOptions) {
    return toast.error(message, { ...options, className: toastClass('toast-error', options) });
  },
  warning(message: string, options?: NotifyOptions) {
    return toast(message, {
      ...options,
      icon: React.createElement(AlertTriangle, { className: 'w-5 h-5 text-amber-400' }),
      className: toastClass('toast-warning', options),
    });
  },
  info(message: string, options?: NotifyOptions) {
    return toast(message, {
      ...options,
      icon: React.createElement(Info, { className: 'w-5 h-5 text-cyan-400' }),
      className: toastClass('toast-info', options),
    });
  },
  dismiss(toastId?: string) {
    toast.dismiss(toastId);
  },
};

