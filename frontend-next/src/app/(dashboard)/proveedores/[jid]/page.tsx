'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, FileText, FolderUp, RefreshCw, Search, Trash2 } from 'lucide-react';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Reveal } from '@/components/motion/Reveal';
import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { SimpleSelect as Select } from '@/components/ui/Select';
import api from '@/services/api';
import toast from 'react-hot-toast';

type LibraryCategory = 'bl' | 'hetero' | 'other';

interface Proveedor {
  id: number;
  jid: string;
  nombre: string;
  tipo: string;
}

interface LibraryItem {
  id: number;
  proveedorJid: string;
  proveedorNombre?: string;
  category: LibraryCategory;
  title: string;
  chapter: string | null;
  tags?: string[];
  ai?: { source?: string | null; model?: string | null; provider?: string | null; confidence?: number | null } | null;
  originalName: string;
  url: string;
  format: string;
  size: number;
  uploadedAt: string;
}

export default function ProveedorLibraryPage() {
  const router = useRouter();
  const params = useParams();
  const idOrJid = useMemo(() => decodeURIComponent(String((params as any)?.jid || '')), [params]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [proveedor, setProveedor] = useState<Proveedor | null>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [stats, setStats] = useState<{ total: number; titles: number; byCategory: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | LibraryCategory>('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);

  const load = async () => {
    if (!idOrJid) return;
    setLoading(true);
    try {
      const data = await api.getProveedorLibrary(idOrJid, { page, limit: 20, search, category });
      setProveedor(data?.proveedor || null);
      setItems(Array.isArray(data?.items) ? data.items : []);
      setPagination(data?.pagination || null);
      setStats(data?.stats || null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error cargando biblioteca');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idOrJid, page, category]);

  const handleSearch = async () => {
    setPage(1);
    await load();
  };

  const onPickFile = () => fileInputRef.current?.click();

  const uploadFile = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      await api.uploadProveedorLibraryFile(idOrJid, file);
      toast.success('Archivo subido y clasificado');
      setPage(1);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error subiendo archivo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteItem = async (itemId: number) => {
    if (!confirm('¿Eliminar este archivo de la biblioteca?')) return;
    try {
      await api.deleteProveedorLibraryItem(idOrJid, itemId);
      toast.success('Archivo eliminado');
      setItems((prev) => prev.filter((x) => x.id !== itemId));
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error eliminando archivo');
    }
  };

  const categoryLabel = (c: 'all' | LibraryCategory) => {
    if (c === 'bl') return 'BL';
    if (c === 'hetero') return 'Hetero';
    if (c === 'other') return 'Otro';
    return 'Todas';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={proveedor?.nombre ? `Biblioteca · ${proveedor.nombre}` : 'Biblioteca del Proveedor'}
        description="Sube y organiza contenido por título, capítulo y categoría (BL / Hetero / Otro)."
        icon={<FileText className="w-8 h-8" />}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => router.push('/proveedores')}>
              Volver
            </Button>
            <Button variant="primary" icon={<FolderUp className="w-4 h-4" />} onClick={onPickFile} loading={uploading}>
              Subir archivo
            </Button>
          </div>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadFile(f);
        }}
      />

      <Stagger className="grid grid-cols-1 md:grid-cols-3 gap-4" delay={0.02} stagger={0.06}>
        <StaggerItem whileHover={{ y: -6, scale: 1.01, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <StatCard title="Archivos" value={stats?.total || 0} icon={<FileText className="w-6 h-6" />} color="primary" />
        </StaggerItem>
        <StaggerItem whileHover={{ y: -6, scale: 1.01, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <StatCard title="Títulos" value={stats?.titles || 0} icon={<Search className="w-6 h-6" />} color="info" />
        </StaggerItem>
        <StaggerItem whileHover={{ y: -6, scale: 1.01, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
          <StatCard
            title="BL"
            value={Number(stats?.byCategory?.bl || 0)}
            icon={<FileText className="w-6 h-6" />}
            color="warning"
          />
        </StaggerItem>
      </Stagger>

      <Card animated className="p-6">
        <div className="flex flex-col md:flex-row gap-4 md:items-end md:justify-between">
          <div className="flex-1">
            <label className="block text-sm text-gray-400 mb-2">Buscar por título / nombre</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
                placeholder="Ej: Jinx cap 10, manhwa BL…"
                className="input-glass w-full pl-10"
              />
            </div>
          </div>

          <div className="w-full md:w-56">
            <label className="block text-sm text-gray-400 mb-2">Categoría</label>
            <Select
              value={category}
              onChange={(v) => {
                setPage(1);
                setCategory((v as any) || 'all');
              }}
              options={[
                { value: 'all', label: categoryLabel('all') },
                { value: 'bl', label: categoryLabel('bl') },
                { value: 'hetero', label: categoryLabel('hetero') },
                { value: 'other', label: categoryLabel('other') },
              ]}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />} onClick={load}>
              Refrescar
            </Button>
            <Button variant="primary" onClick={handleSearch}>
              Buscar
            </Button>
          </div>
        </div>
      </Card>

      <Reveal>
        <Card animated className="p-6">
          {loading ? (
            <div className="p-10 text-center">
              <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Cargando biblioteca...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-gray-300 font-medium mb-2">No hay archivos todavía</p>
              <p className="text-gray-500 mb-6">Sube PDFs o archivos multimedia. El sistema los organizará por título y categoría.</p>
              <Button variant="primary" icon={<FolderUp className="w-4 h-4" />} onClick={onPickFile}>
                Subir primer archivo
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map((it, idx) => (
                <motion.div key={it.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white font-semibold truncate">{it.title || it.originalName}</p>
                      <p className="text-xs text-gray-400 mt-1 truncate">
                        {categoryLabel(it.category)}{it.chapter ? ` · Cap ${it.chapter}` : ''} · {it.format?.toUpperCase() || 'FILE'}
                      </p>
                      <p className="text-xs text-gray-500 mt-2 truncate">{it.originalName}</p>
                      {it.ai?.source === 'ai' && (
                        <div className="mt-3">
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                            IA {Math.round(Number(it.ai?.confidence || 0) * 100)}%
                          </span>
                        </div>
                      )}
                      {Array.isArray(it.tags) && it.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {it.tags.slice(0, 6).map((tag) => (
                            <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-300">
                              {tag}
                            </span>
                          ))}
                          {it.tags.length > 6 && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400">
                              +{it.tags.length - 6}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                      <div className="flex items-center gap-1">
                        <a
                          href={it.url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                          title="Descargar"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => deleteItem(it.id)}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/10">
              <p className="text-sm text-gray-400">
                Página <span className="text-white">{pagination.page}</span> / <span className="text-white">{pagination.totalPages}</span>
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                  Anterior
                </Button>
                <Button variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages}>
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </Card>
      </Reveal>
    </div>
  );
}
