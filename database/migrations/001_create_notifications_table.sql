-- Migración: Crear tabla de notificaciones
-- Fecha: 2026-02-06

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    mensaje TEXT NOT NULL,
    tipo VARCHAR(50) DEFAULT 'info', -- info, success, warning, error, system
    categoria VARCHAR(50) DEFAULT 'general', -- bot, pagos, sistema, etc.
    leida BOOLEAN DEFAULT FALSE,
    user_id INTEGER, -- Para futuras integraciones multiusuario
    data JSONB DEFAULT '{}', -- Metadatos adicionales
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_leida TIMESTAMP WITH TIME ZONE
);

-- Índices para optimizar consultas comunes
CREATE INDEX IF NOT EXISTS idx_notifications_leida ON notifications(leida);
CREATE INDEX IF NOT EXISTS idx_notifications_fecha_creacion ON notifications(fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
