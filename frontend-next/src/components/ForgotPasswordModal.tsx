'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ident = identifier.trim();
    if (!ident) {
      toast.error('Ingresa tu email o tu usuario');
      return;
    }

    setIsLoading(true);
    try {
      await api.requestPasswordResetEmail(ident);
      setStep('success');
      toast.success('Si la cuenta existe, te enviamos un email con el link');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Error al procesar la solicitud');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStep('form');
    setIdentifier('');
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
            <p className="text-muted mb-6 text-sm">
              Ingresá tu email o tu usuario. Te enviaremos un link para restablecer tu contraseña.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-2">Email o usuario</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="tu@email.com o usuario"
                    className="input-glass pl-12"
                    data-autofocus
                  />
                </div>
                <p className="text-xs text-muted/80 mt-1">Si tu cuenta no tiene email, pedí al admin que lo agregue.</p>
              </div>

              <Button type="submit" variant="primary" className="w-full mt-6" loading={isLoading} disabled={isLoading}>
                Enviar link por email
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
            <h3 className="text-lg font-semibold text-foreground mb-2">Revisá tu email</h3>
            <p className="text-muted mb-6 text-sm">
              Si el usuario existe y tiene email, te enviamos un link para restablecer la contraseña.
            </p>
            <div className="p-4 rounded-2xl bg-warning/10 border border-warning/20 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm text-warning font-semibold mb-1">Importante:</p>
                  <ul className="text-xs text-muted space-y-1">
                    <li className={cn('leading-snug')}>Revisá spam/promociones si no llega</li>
                    <li className={cn('leading-snug')}>El link vence en ~30 minutos</li>
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
