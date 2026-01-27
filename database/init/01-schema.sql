-- ============================================
-- PostgreSQL Schema for OguriCap Bot
-- ============================================

-- Funcion para actualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================
-- Usuarios del sistema (JWT/Panel)
-- ============================================
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  rol VARCHAR(20) CHECK (rol IN ('owner', 'admin', 'moderador', 'usuario', 'creador')) NOT NULL,
  whatsapp_number VARCHAR(20),
  fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  activo BOOLEAN DEFAULT TRUE,
  temp_password VARCHAR(255),
  temp_password_expires TIMESTAMP,
  require_password_change BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMP,
  login_ip INET,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ا?ndices para usuarios
CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username);
CREATE INDEX IF NOT EXISTS idx_usuarios_whatsapp ON usuarios(whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_metadata_gin ON usuarios USING GIN(metadata);

-- Trigger para updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_usuarios_updated_at') THEN
    CREATE TRIGGER update_usuarios_updated_at
      BEFORE UPDATE ON usuarios
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- Usuarios de WhatsApp
-- ============================================
CREATE TABLE IF NOT EXISTS whatsapp_users (
  jid VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255),
  stats JSONB DEFAULT '{"exp": 0, "coin": 0, "bank": 0, "level": 0, "health": 100}',
  settings JSONB DEFAULT '{"premium": false, "banned": false, "warn": 0}',
  activity JSONB DEFAULT '{"commands": 0, "afk": -1, "afk_reason": ""}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ا?ndices para WhatsApp users
CREATE INDEX IF NOT EXISTS idx_whatsapp_users_name ON whatsapp_users(name);
CREATE INDEX IF NOT EXISTS idx_whatsapp_users_stats_gin ON whatsapp_users USING GIN(stats);
CREATE INDEX IF NOT EXISTS idx_whatsapp_users_level ON whatsapp_users(((stats->>'level')::int));
CREATE INDEX IF NOT EXISTS idx_whatsapp_users_banned ON whatsapp_users(((settings->>'banned')::boolean)) 
    WHERE (settings->>'banned')::boolean = true;

-- Trigger para updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_whatsapp_users_updated_at') THEN
    CREATE TRIGGER update_whatsapp_users_updated_at
      BEFORE UPDATE ON whatsapp_users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- Chats y grupos
-- ============================================
CREATE TABLE IF NOT EXISTS chats (
  jid VARCHAR(100) PRIMARY KEY,
  settings JSONB DEFAULT '{"is_banned": false, "antilink": false}',
  messages JSONB DEFAULT '{"welcome": null, "bye": null, "promote": null, "demote": null}',
  message_settings JSONB DEFAULT '{"s_welcome": false, "s_bye": false, "s_promote": false, "s_demote": false}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ا?ndices para chats
CREATE INDEX IF NOT EXISTS idx_chats_banned ON chats(((settings->>'is_banned')::boolean)) 
    WHERE (settings->>'is_banned')::boolean = true;
CREATE INDEX IF NOT EXISTS idx_chats_settings_gin ON chats USING GIN(settings);

-- Trigger para updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_chats_updated_at') THEN
    CREATE TRIGGER update_chats_updated_at
      BEFORE UPDATE ON chats
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- Configuraciاün del sistema
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
  key_name VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  version INTEGER DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50)
);

-- ا?ndices para settings
CREATE INDEX IF NOT EXISTS idx_settings_value_gin ON settings USING GIN(value);

-- ============================================
-- Panel data (grupos, pedidos, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS panel_groups (
  id SERIAL PRIMARY KEY,
  wa_jid VARCHAR(100) UNIQUE NOT NULL,
  nombre VARCHAR(255),
  descripcion TEXT,
  config JSONB DEFAULT '{"es_proveedor": false, "bot_enabled": true}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ا?ndices para panel_groups
CREATE INDEX IF NOT EXISTS idx_panel_groups_search_text ON panel_groups 
    USING GIN (to_tsvector('spanish', nombre || ' ' || COALESCE(descripcion, '')));
CREATE INDEX IF NOT EXISTS idx_panel_groups_config_gin ON panel_groups USING GIN(config);
CREATE INDEX IF NOT EXISTS idx_panel_groups_proveedor ON panel_groups(((config->>'es_proveedor')::boolean)) 
    WHERE (config->>'es_proveedor')::boolean = true;

-- Trigger para updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_panel_groups_updated_at') THEN
    CREATE TRIGGER update_panel_groups_updated_at
      BEFORE UPDATE ON panel_groups
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- Tabla de auditorاًa
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(50) NOT NULL,
  record_id VARCHAR(100) NOT NULL,
  action VARCHAR(10) CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  changed_by VARCHAR(50),
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ا?ndices para audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON audit_log(changed_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by ON audit_log(changed_by);

-- ============================================
-- Usuario admin por defecto
-- ============================================
-- Default: admin/admin123
INSERT INTO usuarios (username, password, rol, activo) 
VALUES ('admin', '$2a$10$TzVacCHVPXRyzYzs.59uX.BYll/C/tYpr9ja3tKpjBnQvVf6bp16e', 'owner', true)
ON CONFLICT (username) DO NOTHING;

-- Configuraciاün inicial
INSERT INTO settings (key_name, value, description) VALUES 
('migration_status', '{"completed": false, "version": "1.0.0"}', 'Estado de la migraciاün de base de datos'),
('system_config', '{"maintenance_mode": false, "debug_mode": false}', 'Configuraciاün general del sistema')
ON CONFLICT (key_name) DO NOTHING;
