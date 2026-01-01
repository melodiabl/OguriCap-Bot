import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { MessageCircle, X, Mail, ExternalLink, Ticket } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

function cleanPhoneNumber(input: string) {
  return String(input || '').replace(/[^0-9]/g, '');
}

export const FloatingSupportButton: React.FC = () => {
  const constraintsRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  const { whatsappUrl, emailUrl, supportUrl } = useMemo(() => {
    const whatsapp = cleanPhoneNumber(process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '');
    const email = String(process.env.NEXT_PUBLIC_SUPPORT_EMAIL || '').trim();
    const url = String(process.env.NEXT_PUBLIC_SUPPORT_URL || '').trim();
    const message = encodeURIComponent(String(process.env.NEXT_PUBLIC_SUPPORT_MESSAGE || 'Hola, necesito ayuda con el panel.').trim());

    return {
      whatsappUrl: whatsapp ? `https://wa.me/${whatsapp}?text=${message}` : '',
      emailUrl: email ? `mailto:${email}` : '',
      supportUrl: url,
    };
  }, []);

  return (
    <div ref={constraintsRef} className="fixed inset-0 z-50 pointer-events-none">
      <motion.div
        className="absolute bottom-6 right-6 pointer-events-auto"
        drag
        dragMomentum={false}
        dragConstraints={constraintsRef}
        whileTap={{ scale: 0.98 }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-14 w-14 rounded-full bg-gradient-to-br from-primary-500 to-violet-600 shadow-lg shadow-primary-500/20 border border-white/10 flex items-center justify-center hover:brightness-110 transition"
          title="Soporte"
        >
          <MessageCircle className="w-6 h-6 text-white" />
        </button>
      </motion.div>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Soporte">
        <div className="space-y-4">
          <p className="text-sm text-gray-400 [html.light_&]:text-gray-600">
            Escribe al soporte o crea un ticket para que podamos ayudarte.
          </p>

          <div className="grid grid-cols-1 gap-3">
            <Link href="/soporte" onClick={() => setOpen(false)}>
              <Button variant="primary" className="w-full justify-between" icon={<MessageCircle className="w-4 h-4" />}>
                Chat en el Panel
              </Button>
            </Link>
            {whatsappUrl && (
              <a href={whatsappUrl} target="_blank" rel="noreferrer">
                <Button variant="success" className="w-full justify-between" icon={<ExternalLink className="w-4 h-4" />}>
                  WhatsApp
                </Button>
              </a>
            )}
            {emailUrl && (
              <a href={emailUrl}>
                <Button variant="secondary" className="w-full justify-between" icon={<Mail className="w-4 h-4" />}>
                  Email
                </Button>
              </a>
            )}
            {supportUrl && (
              <a href={supportUrl} target="_blank" rel="noreferrer">
                <Button variant="secondary" className="w-full justify-between" icon={<ExternalLink className="w-4 h-4" />}>
                  Abrir Soporte
                </Button>
              </a>
            )}
            <Link href="/pedidos" onClick={() => setOpen(false)}>
              <Button variant="primary" className="w-full justify-between" icon={<Ticket className="w-4 h-4" />}>
                Crear Ticket (Pedidos)
              </Button>
            </Link>
          </div>

          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setOpen(false)} icon={<X className="w-4 h-4" />}>
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
