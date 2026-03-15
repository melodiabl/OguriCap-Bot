-- ============================================
-- Tabla de Notificaciones para OguriCap Bot
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  mensaje TEXT NOT NULL,
  tipo VARCHAR(20) CHECK (tipo IN ('info', 'success', 'warning', 'error', 'system')) DEFAULT 'info',
  categoria VARCHAR(50) DEFAULT 'general',
  leida BOOLEAN DEFAULT FALSE,
  user_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  data JSONB DEFAULT '{}',
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para notificaciones
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_leida ON notifications(leida);
CREATE INDEX IF NOT EXISTS idx_notifications_tipo ON notifications(tipo);
CREATE INDEX IF NOT EXISTS idx_notifications_fecha_creacion ON notifications(fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_notifications_data_gin ON notifications USING GIN(data);

-- Trigger para updated_at (asumiendo que update_updated_at_column ya existe en 01-schema.sql)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_notifications_updated_at') THEN
        CREATE TRIGGER update_notifications_updated_at 
            BEFORE UPDATE ON notifications 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
EXCEPTION
    WHEN undefined_function THEN
        -- Si la función no existe, crear una simple
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $inner$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $inner$ language 'plpgsql';
        
        CREATE TRIGGER update_notifications_updated_at 
            BEFORE UPDATE ON notifications 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
END
$$;
