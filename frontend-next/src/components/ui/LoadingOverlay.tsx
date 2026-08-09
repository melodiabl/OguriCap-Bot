'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface LoadingOverlayProps {
  open: boolean;
  message?: string;
  details?: string;
}

export function LoadingOverlay({ open, message = 'Procesando...', details }: LoadingOverlayProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="modal-overlay" aria-live="polite" aria-busy="true">
      <div className={cn('modal-content max-w-sm text-center')}>
        <div className="loading-spinner mx-auto mb-4" />
        <p className="text-foreground font-semibold">{message}</p>
        {details && <p className="text-xs text-muted mt-2">{details}</p>}
      </div>
    </div>,
    document.body
  );
}
