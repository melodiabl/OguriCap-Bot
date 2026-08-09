'use client';

import * as React from 'react';

type AvatarUser = {
  id?: number | string | null;
  username?: string | null;
} | null;

const STORAGE_PREFIX = 'oguricap:profile-avatar:';
const AVATAR_UPDATED_EVENT = 'oguricap:profile-avatar-updated';
const MAX_AVATAR_SIZE = 512;

function getUserKey(user: AvatarUser) {
  const id = user?.id;
  if (id !== undefined && id !== null) return `${STORAGE_PREFIX}${id}`;

  const username = String(user?.username || 'local-user').trim().toLowerCase();
  return `${STORAGE_PREFIX}${username || 'local-user'}`;
}

function resizeImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selecciona una imagen valida.'));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      try {
        const scale = Math.min(1, MAX_AVATAR_SIZE / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');
        if (!context) throw new Error('No se pudo procesar la imagen.');

        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer la imagen.'));
    };

    image.src = objectUrl;
  });
}

export function useProfileAvatar(user: AvatarUser) {
  const userId = user?.id;
  const username = user?.username;
  const storageKey = React.useMemo(() => getUserKey({ id: userId, username }), [userId, username]);
  const [avatarDataUrl, setAvatarDataUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      setAvatarDataUrl(window.localStorage.getItem(storageKey));
    } catch {
      setAvatarDataUrl(null);
    }
  }, [storageKey]);

  React.useEffect(() => {
    const handleAvatarUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; value: string | null }>).detail;
      if (!detail || detail.key !== storageKey) return;
      setAvatarDataUrl(detail.value);
    };

    const handleStorageUpdate = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      setAvatarDataUrl(event.newValue);
    };

    window.addEventListener(AVATAR_UPDATED_EVENT, handleAvatarUpdate);
    window.addEventListener('storage', handleStorageUpdate);

    return () => {
      window.removeEventListener(AVATAR_UPDATED_EVENT, handleAvatarUpdate);
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, [storageKey]);

  const saveAvatarFromFile = React.useCallback(
    async (file: File) => {
      const nextAvatar = await resizeImageToDataUrl(file);
      window.localStorage.setItem(storageKey, nextAvatar);
      setAvatarDataUrl(nextAvatar);
      window.dispatchEvent(new CustomEvent(AVATAR_UPDATED_EVENT, { detail: { key: storageKey, value: nextAvatar } }));
    },
    [storageKey]
  );

  const clearAvatar = React.useCallback(() => {
    window.localStorage.removeItem(storageKey);
    setAvatarDataUrl(null);
    window.dispatchEvent(new CustomEvent(AVATAR_UPDATED_EVENT, { detail: { key: storageKey, value: null } }));
  }, [storageKey]);

  return {
    avatarDataUrl,
    saveAvatarFromFile,
    clearAvatar,
  };
}
