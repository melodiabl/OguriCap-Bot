import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Phone, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { AnimatedButton } from './ui/AnimatedButton';
import toast from 'react-hot-toast';
import api from '../config/api';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    whatsapp_number: ''
  });
  const [result, setResult] = useState<{
    tempPassword?: string;
    username?: string;
    expiresIn?: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username.trim() && !formData.whatsapp_number.trim()) {
      toast.error('Ingresa tu nombre de usuario o número de WhatsApp');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/api/auth/reset-password', {
        username: formData.username.trim() || undefined,
        whatsapp_number: formData.whatsapp_number.trim() || undefined
      });

      if (response.data.success) {
        setResult(response.data);
        setStep('success');
        toast.success('Contraseña temporal generada exitosamente');
      } else {
        toast.error(response.data.message || 'Error al generar contraseña temporal');
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || error?.message || 'Error al procesar la solicitud';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStep('form');
    setFormData({ username: '', whatsapp_number: '' });
    setResult(null);
    onClose();
  };

  const handleBackToLogin = () => {
    handleClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="glass-card p-6 w-full max-w-md relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">
                {step === 'form' ? 'Recuperar Contraseña' : 'Contraseña Temporal'}
              </h2>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {step === 'form' && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <p className="text-gray-400 mb-6 text-sm">
                  Ingresa tu nombre de usuario o número de WhatsApp para generar una contraseña temporal.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Username field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Nombre de Usuario
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="Ingresa tu usuario"
                        className="input-glass pl-12"
                        autoComplete="username"
                      />
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-dark-900 text-gray-500">o</span>
                    </div>
                  </div>

                  {/* WhatsApp number field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Número de WhatsApp
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="tel"
                        value={formData.whatsapp_number}
                        onChange={(e) => setFormData(prev => ({ ...prev, whatsapp_number: e.target.value }))}
                        placeholder="Ej: 51900373696"
                        className="input-glass pl-12"
                        autoComplete="tel"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Ingresa el número sin espacios ni símbolos
                    </p>
                  </div>

                  {/* Submit button */}
                  <AnimatedButton
                    type="submit"
                    variant="primary"
                    fullWidth
                    loading={isLoading}
                    className="mt-6"
                  >
                    Generar Contraseña Temporal
                  </AnimatedButton>
                </form>

                {/* Back to login */}
                <button
                  onClick={handleBackToLogin}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mt-4 mx-auto"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver al inicio de sesión
                </button>
              </motion.div>
            )}

            {step === 'success' && result && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-center"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>

                <h3 className="text-lg font-semibold text-white mb-2">
                  ¡Contraseña Temporal Generada!
                </h3>

                <p className="text-gray-400 mb-6 text-sm">
                  Se ha generado una contraseña temporal para el usuario <strong>{result.username}</strong>
                </p>

                {/* Temporary password display */}
                <div className="p-4 rounded-xl bg-primary-500/10 border border-primary-500/20 mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-amber-400" />
                    <span className="text-sm font-medium text-amber-400">Contraseña Temporal</span>
                  </div>
                  <div className="text-2xl font-mono font-bold text-white tracking-wider">
                    {result.tempPassword}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Válida por {result.expiresIn || '24 horas'}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="text-left">
                      <p className="text-sm text-amber-400 font-medium mb-1">Importante:</p>
                      <ul className="text-xs text-gray-400 space-y-1">
                        <li>• Esta contraseña es temporal y expira en {result.expiresIn || '24 horas'}</li>
                        <li>• Solo puede usarse una vez</li>
                        <li>• Se recomienda cambiar la contraseña después del login</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <AnimatedButton
                  onClick={handleBackToLogin}
                  variant="primary"
                  fullWidth
                >
                  Continuar al Login
                </AnimatedButton>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ForgotPasswordModal;