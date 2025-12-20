import React, { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { SocketProvider } from './contexts/SocketContext';
import { ModernLayout } from './components/ModernLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { motion, AnimatePresence } from 'framer-motion';

// Loading component with animation
const LoadingScreen: React.FC<{ message?: string }> = ({ message = 'Cargando...' }) => (
  <div className="min-h-screen mesh-bg flex items-center justify-center">
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        className="w-16 h-16 mx-auto mb-4 border-4 border-primary-500/30 border-t-primary-500 rounded-full"
      />
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-gray-400"
      >
        {message}
      </motion.p>
    </motion.div>
  </div>
);

// Lazy load pages
const Login = lazy(() => import('./pages/Login'));
const ModernDashboard = lazy(() => import('./pages/ModernDashboard'));
const BotStatus = lazy(() => import('./pages/BotStatus'));
const Grupos = lazy(() => import('./pages/Grupos'));
const GruposManagement = lazy(() => import('./pages/GruposManagement'));
const Aportes = lazy(() => import('./pages/Aportes'));
const Pedidos = lazy(() => import('./pages/Pedidos'));
const Settings = lazy(() => import('./pages/Settings'));
const Proveedores = lazy(() => import('./pages/Proveedores'));
const Usuarios = lazy(() => import('./pages/Usuarios'));
const Subbots = lazy(() => import('./pages/Subbots'));
const Logs = lazy(() => import('./pages/Logs'));
const Notificaciones = lazy(() => import('./pages/Notificaciones'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Multimedia = lazy(() => import('./pages/Multimedia'));
const AiChat = lazy(() => import('./pages/AiChat'));
const BotCommands = lazy(() => import('./pages/BotCommands'));

// Query client with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: true,
      staleTime: 5000,
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen message="Verificando autenticación..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingScreen />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
};

// Public Route Component
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen message="Verificando autenticación..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingScreen />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
};

// App Routes
const AppRoutes: React.FC = () => {
  return (
    <Router>
      <AnimatePresence mode="wait">
        <Routes>
          {/* Public route */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <ModernLayout>
                  <ModernDashboard />
                </ModernLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/bot"
            element={
              <ProtectedRoute>
                <ModernLayout>
                  <BotStatus />
                </ModernLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/usuarios"
            element={
              <ProtectedRoute>
                <ModernLayout>
                  <Usuarios />
                </ModernLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/subbots"
            element={
              <ProtectedRoute>
                <ModernLayout>
                  <Subbots />
                </ModernLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/grupos"
            element={
              <ProtectedRoute>
                <ModernLayout>
                  <Grupos />
                </ModernLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/grupos-management"
            element={
              <ProtectedRoute>
                <ModernLayout>
                  <GruposManagement />
                </ModernLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/aportes"
            element={
              <ProtectedRoute>
                <ModernLayout>
                  <Aportes />
                </ModernLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/pedidos"
            element={
              <ProtectedRoute>
                <ModernLayout>
                  <Pedidos />
                </ModernLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/proveedores"
            element={
              <ProtectedRoute>
                <ModernLayout>
                  <Proveedores />
                </ModernLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/logs"
            element={
              <ProtectedRoute>
                <ModernLayout>
                  <Logs />
                </ModernLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/notificaciones"
            element={
              <ProtectedRoute>
                <ModernLayout>
                  <Notificaciones />
                </ModernLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <ModernLayout>
                  <Analytics />
                </ModernLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/multimedia"
            element={
              <ProtectedRoute>
                <ModernLayout>
                  <Multimedia />
                </ModernLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <ModernLayout>
                  <Settings />
                </ModernLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/ai-chat"
            element={
              <ProtectedRoute>
                <ModernLayout>
                  <AiChat />
                </ModernLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/bot-commands"
            element={
              <ProtectedRoute>
                <ModernLayout>
                  <BotCommands />
                </ModernLayout>
              </ProtectedRoute>
            }
          />

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </Router>
  );
};

// Main App Component
const App: React.FC = () => {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SocketProvider>
            <NotificationProvider>
              <ErrorBoundary>
                <Suspense fallback={<LoadingScreen message="Cargando aplicación..." />}>
                  <AppRoutes />
                </Suspense>
              </ErrorBoundary>
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: 'rgba(30, 41, 59, 0.95)',
                    color: '#fff',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                  },
                  success: {
                    iconTheme: {
                      primary: '#10b981',
                      secondary: '#fff',
                    },
                  },
                  error: {
                    iconTheme: {
                      primary: '#ef4444',
                      secondary: '#fff',
                    },
                  },
                }}
              />
            </NotificationProvider>
          </SocketProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
