import React from 'react';
import toast, { type ToastOptions } from 'react-hot-toast';
import { AlertCircle, CheckCircle, Info, AlertTriangle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type NotifyOptions = ToastOptions & {
  title?: string;
};

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
    return toast.custom(
      (t) => (
        <div className={cn(t.visible ? 'animate-enter' : 'animate-leave')}>
          <CustomToast type="success" title={options?.title || 'Éxito'} message={message} />
        </div>
      ),
      { duration: 4000, position: 'top-right', ...options }
    );
  },
  error(message: string, options?: NotifyOptions) {
    return toast.custom(
      (t) => (
        <div className={cn(t.visible ? 'animate-enter' : 'animate-leave')}>
          <CustomToast type="error" title={options?.title || 'Error'} message={message} />
        </div>
      ),
      { duration: 6000, position: 'top-right', ...options }
    );
  },
  warning(message: string, options?: NotifyOptions) {
    return toast.custom(
      (t) => (
        <div className={cn(t.visible ? 'animate-enter' : 'animate-leave')}>
          <CustomToast type="warning" title={options?.title || 'Atención'} message={message} />
        </div>
      ),
      { duration: 5000, position: 'top-right', ...options }
    );
  },
  info(message: string, options?: NotifyOptions) {
    return toast.custom(
      (t) => (
        <div className={cn(t.visible ? 'animate-enter' : 'animate-leave')}>
          <CustomToast type="info" title={options?.title || 'Información'} message={message} />
        </div>
      ),
      { duration: 4000, position: 'top-right', ...options }
    );
  },
  system(message: string, options?: NotifyOptions) {
    return toast.custom(
      (t) => (
        <div className={cn(t.visible ? 'animate-enter' : 'animate-leave')}>
          <CustomToast type="system" title={options?.title || 'Sistema'} message={message} />
        </div>
      ),
      { duration: 5000, position: 'top-right', ...options }
    );
  },
  dismiss(toastId?: string) {
    toast.dismiss(toastId);
  },
};
