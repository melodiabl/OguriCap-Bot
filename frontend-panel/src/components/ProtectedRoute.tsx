import React from 'react';
import { motion } from 'framer-motion';
import { Shield, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { AnimatedButton } from './ui/AnimatedButton';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPage: string;
  fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredPage, 
  fallback 
}) => {
  const { hasPermission, userRole } = usePermissions();
  const navigate = useNavigate();

  if (!hasPermission(requiredPage)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-8 max-w-md w-full text-center"
        >
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <Shield className="w-8 h-8 text-red-400" />
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-4">
            Acceso Denegado
          </h2>
          
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <span className="text-sm font-medium text-amber-400">Permisos Insuficientes</span>
            </div>
            <p className="text-sm text-gray-400">
              Tu rol actual <strong className="text-white">({userRole})</strong> no tiene permisos 
              para acceder a esta página.
            </p>
          </div>

          <p className="text-gray-400 mb-6 text-sm">
            Si necesitas acceso a esta funcionalidad, contacta con un administrador 
            para que revise tus permisos.
          </p>

          <div className="space-y-3">
            <AnimatedButton
              onClick={() => navigate(-1)}
              variant="primary"
              fullWidth
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Volver Atrás
            </AnimatedButton>
            
            <AnimatedButton
              onClick={() => navigate('/')}
              variant="secondary"
              fullWidth
            >
              Ir al Dashboard
            </AnimatedButton>
          </div>

          <div className="mt-6 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-xs text-blue-400 font-medium mb-1">Información de Contacto</p>
            <p className="text-xs text-gray-400">
              Para solicitar permisos adicionales, contacta con el administrador del sistema.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;