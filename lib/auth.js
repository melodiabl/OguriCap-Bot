import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Database from './database.js';
import configManager from './config-manager.js';

const router = express.Router();

// Inicializar base de datos
const db = new Database('./database.json');

// Obtener configuración
const getConfig = () => configManager.getConfig('main');

// Middleware de autenticacion
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    const config = getConfig();
    const jwtSecret = String(process.env.JWT_SECRET || config?.security?.jwtSecret || '').trim();
    if (!jwtSecret) return res.status(500).json({ error: 'JWT_SECRET no configurado' });
    
    const decoded = jwt.verify(token, jwtSecret);
    
    // Buscar usuario en la base de datos
    const users = db.data.usuarios || {};
    const user = Object.values(users).find(u => u.username === decoded.username);

    if (!user) {
      return res.status(403).json({ error: 'Usuario no valido' });
    }

    req.user = { id: user.id, username: user.username, rol: user.rol };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token invalido' });
  }
};

// Middleware de autorizacion por roles
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'No tienes permisos para esta accion' });
    }
    next();
  };
};

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    // Buscar usuario en la base de datos
    const users = db.data.usuarios || {};
    const user = Object.values(users).find(u => u.username === username);

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Si se proporciona un rol, verificar que coincida con el rol del usuario
    if (role && user.rol !== role) {
      return res.status(403).json({ error: 'No tienes permisos para acceder con este rol' });
    }

    const config = getConfig();
    const jwtSecret = String(process.env.JWT_SECRET || config?.security?.jwtSecret || '').trim();
    if (!jwtSecret) return res.status(500).json({ error: 'JWT_SECRET no configurado' });
    const jwtExpiry = process.env.JWT_EXPIRY || config?.security?.jwtExpiry || '24h';

    const token = jwt.sign({ username: user.username, rol: user.rol }, jwtSecret, { expiresIn: jwtExpiry });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        rol: user.rol
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Register (solo admin y owner)
router.post('/register', authenticateToken, authorizeRoles('admin', 'owner'), async (req, res) => {
  try {
    const { username, password, rol, whatsapp_number } = req.body;

    if (!username || !password || !rol) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    if (!['admin', 'colaborador', 'usuario', 'owner', 'creador', 'moderador'].includes(rol)) {
      return res.status(400).json({ error: 'Rol no válido' });
    }

    // Verificar si el usuario ya existe
    const users = db.data.usuarios || {};
    const existingUser = Object.values(users).find(u => u.username === username);
    
    if (existingUser) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }

    const config = getConfig();
    const bcryptRounds = config?.security?.bcryptRounds || 10;
    const hashedPassword = await bcrypt.hash(password, bcryptRounds);

    // Generar nuevo ID
    const userIds = Object.keys(users).map(id => parseInt(id)).filter(id => !isNaN(id));
    const newId = userIds.length > 0 ? Math.max(...userIds) + 1 : 1;

    // Crear usuario
    if (!db.data.usuarios) db.data.usuarios = {};
    db.data.usuarios[newId] = {
      id: newId,
      username,
      password: hashedPassword,
      rol,
      whatsapp_number: whatsapp_number || null,
      fecha_registro: new Date().toISOString(),
      created_at: new Date().toISOString(),
      activo: true
    };

    // Guardar cambios
    db.save();

    res.json({ success: true, message: 'Usuario creado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Auto-register desde WhatsApp (sin autenticacion)
router.post('/auto-register', async (req, res) => {
  try {
    const { whatsapp_number, username, grupo_jid } = req.body;

    if (!whatsapp_number || !username || !grupo_jid) {
      return res.status(400).json({ error: 'Número de WhatsApp, username y grupo son requeridos' });
    }

    // Nueva lógica: respetar estado global y por grupo (ON/OFF)
    // 1) Verificar estado global del bot
    try {
      const botState = db.data.panel?.botGlobalState;
      if (botState && botState.isOn === false) {
        return res.status(403).json({ error: 'Bot global desactivado para registro automático' });
      }
    } catch (_) {
      // Si no existe el registro, asumimos encendido por compatibilidad
    }

    // 2) Verificar estado por grupo si existe registro; por defecto está activo
    try {
      const grupos = db.data.panel?.groups || {};
      const grupo = Object.values(grupos).find(g => g.wa_jid === grupo_jid);
      if (grupo && grupo.bot_enabled === false) {
        return res.status(403).json({ error: 'Bot desactivado en este grupo para registro automático' });
      }
    } catch (_) {
      // Si no existe la tabla o falla la consulta, continuar (modo por defecto activo)
    }

    // Verificar si el usuario ya existe
    const users = db.data.usuarios || {};
    const existingUser = Object.values(users).find(u => u.username === username);
    if (existingUser) {
      return res.status(400).json({ error: 'El nombre de usuario ya existe' });
    }

    // Generar contraseña temporal simple
    const tempPassword = 'temp' + Math.random().toString(36).substring(2, 8);
    const config = getConfig();
    const bcryptRounds = config?.security?.bcryptRounds || 10;
    const hashedPassword = await bcrypt.hash(tempPassword, bcryptRounds);

    // Generar nuevo ID
    const userIds = Object.keys(users).map(id => parseInt(id)).filter(id => !isNaN(id));
    const newId = userIds.length > 0 ? Math.max(...userIds) + 1 : 1;

    // Crear usuario
    if (!db.data.usuarios) db.data.usuarios = {};
    db.data.usuarios[newId] = {
      id: newId,
      username,
      password: hashedPassword,
      rol: 'usuario',
      whatsapp_number,
      grupo_registro: grupo_jid,
      fecha_registro: new Date().toISOString(),
      activo: true,
      temp_password: tempPassword,
      temp_password_expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
      temp_password_used: false,
      require_password_change: true
    };

    // Guardar cambios
    db.save();

    res.json({
      success: true,
      message: 'Usuario registrado correctamente',
      tempPassword: tempPassword,
      username: username
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { whatsapp_number, username } = req.body;

    if (!whatsapp_number || !username) {
      return res.status(400).json({ error: 'Número de WhatsApp y username son requeridos' });
    }

    const users = db.data.usuarios || {};
    const user = Object.values(users).find(u => u.username === username && u.whatsapp_number === whatsapp_number);

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado o número de WhatsApp no coincide' });
    }

    // Generar nueva contraseña temporal simple
    const tempPassword = 'reset' + Math.random().toString(36).substring(2, 8);
    const config = getConfig();
    const bcryptRounds = config?.security?.bcryptRounds || 10;
    const hashedPassword = await bcrypt.hash(tempPassword, bcryptRounds);

    // Actualizar contraseña
    user.password = hashedPassword;
    user.temp_password = tempPassword;
    user.temp_password_expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 horas
    user.temp_password_used = false;
    user.require_password_change = true;

    // Guardar cambios
    db.save();

    res.json({
      success: true,
      message: 'Contraseña restablecida correctamente',
      tempPassword: tempPassword,
      username: username
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Change password (usuario autenticado)
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Contraseña actual y nueva contraseña son requeridas'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'La nueva contraseña debe tener al menos 6 caracteres'
      });
    }

    const users = db.data.usuarios || {};
    const user = Object.values(users).find(u => u.username === req.user.username);

    if (!user) {
      return res.status(404).json({ 
        error: 'Usuario no encontrado'
      });
    }

    // Validar contraseña actual
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ 
        error: 'Contraseña actual incorrecta'
      });
    }

    // Verificar que la nueva contraseña sea diferente a la actual
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        error: 'La nueva contraseña debe ser diferente a la actual'
      });
    }

    const config = getConfig();
    const bcryptRounds = config?.security?.bcryptRounds || 10;
    const hashedPassword = await bcrypt.hash(newPassword, bcryptRounds);
    
    // Actualizar contraseña
    user.password = hashedPassword;
    user.password_changed_at = new Date().toISOString();
    user.temp_password = null;
    user.temp_password_expires = null;
    user.temp_password_used = null;
    user.require_password_change = false;

    // Guardar cambios
    db.save();

    res.json({ 
      success: true, 
      message: 'Contraseña cambiada correctamente'
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message
    });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  res.json(req.user);
});

export { router, authenticateToken, authorizeRoles };
