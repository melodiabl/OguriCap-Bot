'use client';
import { notify } from '@/lib/notif';

/* eslint-disable @next/next/no-img-element */

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Camera, Trash2 } from 'lucide-react';


import { useAuth } from '@/contexts/AuthContext';
import { useProfileAvatar } from '@/hooks/useProfileAvatar';
import { cn } from '@/lib/utils';

type AvatarSize = 'sm' | 'md' | 'lg';

interface ProfileAvatarProps {
  editable?: boolean;
  size?: AvatarSize;
  className?: string;
  showRemove?: boolean;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
};

export function ProfileAvatar({ editable = false, size = 'md', className, showRemove = true }: ProfileAvatarProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const { avatarDataUrl, saveAvatarFromFile, clearAvatar } = useProfileAvatar(user);
  const [isSaving, setIsSaving] = React.useState(false);

  const initials = React.useMemo(() => {
    const username = String(user?.username || 'Usuario').trim();
    return username.slice(0, 2).toUpperCase();
  }, [user?.username]);

  const handlePickAvatar = () => {
    if (!editable) return;
    inputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      setIsSaving(true);
      await saveAvatarFromFile(file);
      notify.success('Foto de perfil actualizada');
    } catch (error: any) {
      notify.error(error?.message || 'No se pudo actualizar la foto');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={cn('relative shrink-0', className)}>
      <motion.button
        type="button"
        onClick={handlePickAvatar}
        disabled={!editable || isSaving}
        aria-label={editable ? 'Cambiar foto de perfil' : 'Foto de perfil'}
        className={cn(
          'group relative isolate flex items-center justify-center overflow-hidden rounded-lg border border-white/12 bg-gradient-to-br from-[#25d366]/25 via-[#2dd4bf]/14 to-[#ff4d8d]/16 font-black text-white shadow-[0_16px_42px_rgba(0,0,0,0.24)] ring-1 ring-[#25d366]/20',
          sizeClasses[size],
          editable && 'cursor-pointer transition hover:border-[#25d366]/45 hover:ring-[#25d366]/35',
          !editable && 'cursor-default'
        )}
        whileHover={editable && !reduceMotion ? { y: -2, scale: 1.02 } : undefined}
        whileTap={editable && !reduceMotion ? { scale: 0.98 } : undefined}
      >
        {avatarDataUrl ? (
          <img src={avatarDataUrl} alt="" className="h-full w-full object-cover" decoding="async" />
        ) : (
          <span>{initials}</span>
        )}

        {editable && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
            <Camera className="h-4 w-4 text-white" />
          </span>
        )}

        {isSaving && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[10px] font-black uppercase tracking-[0.18em] text-white">
            Guardando
          </span>
        )}
      </motion.button>

      {editable && showRemove && avatarDataUrl && (
        <button
          type="button"
          onClick={clearAvatar}
          aria-label="Quitar foto de perfil"
          className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-[#111713] text-white shadow-lg transition hover:border-[#ff4d8d]/45 hover:text-[#ff9fbd]"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}

      {editable && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      )}
    </div>
  );
}
