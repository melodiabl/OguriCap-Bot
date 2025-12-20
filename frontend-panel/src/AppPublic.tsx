import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { NotificationProvider } from './contexts/NotificationContext';
import { SocketProvider } from './contexts/SocketContext';
import { ModernLayout } from './components/ModernLayout';

// Páginas principales
import Dashboard from './pages/Dashboard';
import AiChat from './pages/AiChat';
import BotStatus from './pages/BotStatus';
import Analytics from './pages/Analytics';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Mock user para versión pública
const mockUser = {
  id: 1,
  username: 'demo-public',
  rol: 'admin',
  estado: 'activo'
};

const AppPublic: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        <SocketProvider>
          <Router>
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900">
              <Routes>
                <Route path="/" element={<Navigate to="/ai-chat" replace />} />
                <Route path="/*" element={
                  <ModernLayout user={mockUser}>
                    <Routes>
                      <Route path="/ai-chat" element={<AiChat />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/bot" element={<BotStatus />} />
                      <Route path="/analytics" element={<Analytics />} />
                      <Route path="*" element={<Navigate to="/ai-chat" replace />} />
                    </Routes>
                  </ModernLayout>
                } />
              </Routes>
            </div>
          </Router>
        </SocketProvider>
      </NotificationProvider>
    </QueryClientProvider>
  );
};

export default AppPublic;