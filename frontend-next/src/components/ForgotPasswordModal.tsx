'use client';
import { notify } from '@/lib/notif';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowLeft, CheckCircle, AlertCircle, Loader2, ShieldCheck, Clock, KeyRound, Info } from 'lucide-react';


import api from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [method, setMethod] = useState<'email' | 'whatsapp'>('email');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setIdentifier('');
      setFieldError(null);
      setAttempts(0);
    }
  }, [isOpen]);

  const validateIdentifier = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return method === 'email' ? 'Ingresa tu email' : 'Ingresa tu número de WhatsApp';
    if (method === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmed)) return 'Ingresa un email válido';
    } else {
      const waRegex = /^\d{8,15}$/;
      const cleaned = trimmed.replace(/\D/g, '');
      if (!waRegex.test(cleaned)) return 'Ingresa un número válido (8-15 dígitos)';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const error = validateIdentifier(identifier);
    if (error) {
      setFieldError(error);
      notify.error(error);
      return;
    }

    if (attempts >= 3) {
      notify.error('Demasiados intentos. Intenta más tarde');
      return;
    }

    setIsLoading(true);
    setFieldError(null);
    try {
      await api.requestPasswordResetEmail(identifier);
      setStep('success');
      notify.success('Te enviamos un link de recuperación');
    } catch (error: any) {
      setAttempts(prev => prev + 1);
      const msg = error?.response?.data?.error || 'Error al procesar la solicitud';
      setFieldError(msg);
      notify.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStep('form');
    setIdentifier('');
    setFieldError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 'form' ? 'Recuperar contraseña' : 'Listo'}
      className="max-w-md"
    >
      <AnimatePresence mode="wait" initial={false}>
        {step === 'form' ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
          >
            <div className="mb-6 p-4 rounded-2xl bg-accent/5 border border-accent/15">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted">
                  Ingresá tus datos y te enviaremos un código de verificación seguro para restablecer tu contraseña.
                </p>
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => { setMethod('email'); setIdentifier(''); setFieldError(null); }}
                className={cn(
                  'flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all',
                  method === 'email'
                    ? 'bg-primary text-white'
                    : 'bg-card text-muted hover:bg-card/80'
                )}
              >
                <Mail className="w-4 h-4 inline mr-2" />
                Email
              </button>
              <button
                type="button"
                onClick={() => { setMethod('whatsapp'); setIdentifier(''); setFieldError(null); }}
                disabled
                className={cn(
                  'flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all opacity-50 cursor-not-allowed',
                  method === 'whatsapp'
                    ? 'bg-primary text-white'
                    : 'bg-card text-muted'
                )}
                title="Próximamente"
              >
                <KeyRound className="w-4 h-4 inline mr-2" />
                WhatsApp
              <span className="ml-1 text-xs opacity-60">(próximamente)</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  {method === 'email' ? 'Tu email registrado' : 'Tu número de WhatsApp'}
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                  <input
                    type={method === 'email' ? 'email' : 'tel'}
                    value={identifier}
                    onChange={(e) => { setIdentifier(e.target.value); setFieldError(null); }}
                    placeholder={method === 'email' ? 'tu@email.com' : '5959XXXXXXXX'}
                    className={cn('input-glass pl-12', fieldError && 'is-error')}
                    data-autofocus
                    inputMode={method === 'email' ? 'email' : 'tel'}
                  />
                </div>
                {fieldError && (
                  <p className="text-xs text-destructive mt-1">{fieldError}</p>
                )}
              </div>

              {method === 'email' && (
                <div className="p-3 rounded-xl bg-muted/30 border border-muted/40">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <Info className="w-4 h-4" />
                    <span>Si no tienes email registrado, contacta al admin</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted">
                <Clock className="w-4 h-4" />
                <span>El código vence en 30 minutos</span>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                loading={isLoading}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ShieldCheck className="w-4 h-4 mr-2" />
                )}
                Enviar código de verificación
              </Button>
            </form>

            <button
              type="button"
              onClick={handleClose}
              className="mt-4 mx-auto flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors focus-ring-animated"
            >
              <ArrowLeft className="w-4 h-4" /> Volver al inicio de sesión
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            className="text-center"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-success/15 border border-success/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">¡Código enviado!</h3>
            <p className="text-muted mb-6 text-sm">
              Revisa tu {method === 'email' ? 'bandeja de entrada' : 'WhatsApp'}. Te enviamos un código para restablecer tu contraseña.
            </p>
            <div className="p-4 rounded-2xl bg-warning/10 border border-warning/20 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm text-warning font-semibold mb-1">Importante:</p>
                  <ul className="text-xs text-muted space-y-1">
                    <li className={cn('leading-snug')}>Revisá spam/promociones si no llega</li>
                    <li className={cn('leading-snug')}>El código vence en 30 minutos</li>
                    <li className={cn('leading-snug')}>Solo se puede usar una vez</li>
                  </ul>
                </div>
              </div>
            </div>
            <Button onClick={handleClose} variant="primary" className="w-full">
              Continuar al Login
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
};

export default ForgotPasswordModal;
