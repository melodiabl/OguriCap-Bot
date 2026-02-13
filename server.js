import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import notificationRoutes from './routes/notifications-routes.js';
import emailRoutes from './routes/email-routes.js';
import logger from './lib/log-manager.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PATCH", "DELETE"]
    }
});

// Hacer io global para que los controladores puedan usarlo
global.io = io;

app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/notifications', notificationRoutes);
app.use('/api/email', emailRoutes);

// Manejo de errores global
app.use((err, req, res, next) => {
    logger.error('Unhandled Error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    logger.info(`Servidor API ejecutándose en el puerto ${PORT}`);
});

io.on('connection', (socket) => {
    logger.info(`Cliente conectado: ${socket.id}`);
    
    socket.on('disconnect', () => {
        logger.info(`Cliente desconectado: ${socket.id}`);
    });
});

export default server;
