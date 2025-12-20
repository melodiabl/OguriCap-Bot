import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Card,
  CardBody,
  Grid,
  GridItem,
  useColorModeValue,
  Spinner,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { useQuery } from 'react-query';
import { apiService } from '../../services/api';
import { QuickStatsWidget } from './QuickStatsWidget';
import { ActivityFeedWidget } from './ActivityFeedWidget';
import { FiUsers, FiFileText, FiShoppingCart, FiActivity } from 'react-icons/fi';

interface DashboardData {
  stats: {
    totalUsers: number;
    totalGroups: number;
    totalAportes: number;
    totalPedidos: number;
    activeUsers: number;
    pendingAportes: number;
    pendingPedidos: number;
    botStatus: 'online' | 'offline' | 'connecting';
  };
  recentActivity: Array<{
    id: string;
    type: 'user' | 'group' | 'aporte' | 'pedido' | 'system';
    action: string;
    description: string;
    user?: string;
    timestamp: string;
  }>;
}

export const DashboardWidget: React.FC = () => {
  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  // Query para obtener datos del dashboard
  const { data: dashboardData, isLoading, error } = useQuery(
    'dashboard',
    async () => {
      // TODO: Implementar endpoint de dashboard en backend
      return {
        stats: {
          totalUsers: 1250,
          totalGroups: 45,
          totalAportes: 2340,
          totalPedidos: 890,
          activeUsers: 890,
          pendingAportes: 15,
          pendingPedidos: 3,
          botStatus: 'online' as const,
        },
        recentActivity: [
          {
            id: '1',
            type: 'aporte' as const,
            action: 'Aporte Aprobado',
            description: 'El aporte "Ejemplo de contenido" ha sido aprobado',
            user: 'admin',
            timestamp: new Date().toISOString(),
          },
          {
            id: '2',
            type: 'user' as const,
            action: 'Usuario Registrado',
            description: 'Nuevo usuario se ha registrado en el sistema',
            user: 'sistema',
            timestamp: new Date(Date.now() - 300000).toISOString(),
          },
          {
            id: '3',
            type: 'pedido' as const,
            action: 'Pedido Resuelto',
            description: 'El pedido #123 ha sido resuelto exitosamente',
            user: 'admin',
            timestamp: new Date(Date.now() - 600000).toISOString(),
          },
          {
            id: '4',
            type: 'group' as const,
            action: 'Grupo Autorizado',
            description: 'El grupo "Grupo de Prueba" ha sido autorizado',
            user: 'admin',
            timestamp: new Date(Date.now() - 900000).toISOString(),
          },
        ],
      } as DashboardData;
    },
    {
      refetchInterval: 30000, // Auto-refresh cada 30 segundos
    }
  );

  if (error) {
    return (
      <Alert status="error">
        <AlertIcon />
        Error al cargar el dashboard
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
        <Text mt={4}>Cargando dashboard...</Text>
      </Box>
    );
  }

  const quickStats = [
    {
      label: 'Total Usuarios',
      value: dashboardData?.stats.totalUsers || 0,
      change: 12.5,
      icon: FiUsers,
      color: 'blue.500',
    },
    {
      label: 'Grupos Activos',
      value: dashboardData?.stats.totalGroups || 0,
      change: 8.3,
      icon: FiActivity,
      color: 'green.500',
    },
    {
      label: 'Total Aportes',
      value: dashboardData?.stats.totalAportes || 0,
      change: 15.7,
      icon: FiFileText,
      color: 'purple.500',
    },
    {
      label: 'Pedidos Resueltos',
      value: dashboardData?.stats.totalPedidos || 0,
      change: 22.1,
      icon: FiShoppingCart,
      color: 'orange.500',
    },
  ];

  const pendingStats = [
    {
      label: 'Aportes Pendientes',
      value: dashboardData?.stats.pendingAportes || 0,
      icon: FiFileText,
      color: 'yellow.500',
    },
    {
      label: 'Pedidos Pendientes',
      value: dashboardData?.stats.pendingPedidos || 0,
      icon: FiShoppingCart,
      color: 'red.500',
    },
  ];

  return (
    <VStack spacing={6} align="stretch">
      {/* Estadísticas Principales */}
      <QuickStatsWidget
        stats={quickStats}
        title="Estadísticas Generales"
        columns={4}
      />

      <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6}>
        {/* Actividad Reciente */}
        <Card bg={cardBg} border="1px" borderColor={borderColor}>
          <CardBody>
            <ActivityFeedWidget
              activities={dashboardData?.recentActivity || []}
              title="Actividad Reciente"
              maxItems={5}
            />
          </CardBody>
        </Card>

        {/* Panel Lateral */}
        <VStack spacing={4} align="stretch">
          {/* Estado del Bot */}
          <Card bg={cardBg} border="1px" borderColor={borderColor}>
            <CardBody>
              <Text fontSize="lg" fontWeight="bold" mb={4}>
                Estado del Bot
              </Text>
              <VStack spacing={3} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="sm">Estado</Text>
                  <Box
                    w={3}
                    h={3}
                    borderRadius="full"
                    bg={dashboardData?.stats.botStatus === 'online' ? 'green.500' : 'red.500'}
                  />
                </HStack>
                <HStack justify="space-between">
                  <Text fontSize="sm">Usuarios Activos</Text>
                  <Text fontSize="sm" fontWeight="bold">
                    {dashboardData?.stats.activeUsers}
                  </Text>
                </HStack>
              </VStack>
            </CardBody>
          </Card>

          {/* Pendientes */}
          <Card bg={cardBg} border="1px" borderColor={borderColor}>
            <CardBody>
              <Text fontSize="lg" fontWeight="bold" mb={4}>
                Pendientes
              </Text>
              <VStack spacing={3} align="stretch">
                {pendingStats.map((stat, index) => (
                  <HStack key={index} justify="space-between">
                    <HStack>
                      <Box
                        w={3}
                        h={3}
                        borderRadius="full"
                        bg={stat.color}
                      />
                      <Text fontSize="sm">{stat.label}</Text>
                    </HStack>
                    <Text fontSize="sm" fontWeight="bold">
                      {stat.value}
                    </Text>
                  </HStack>
                ))}
              </VStack>
            </CardBody>
          </Card>

          {/* Acciones Rápidas */}
          <Card bg={cardBg} border="1px" borderColor={borderColor}>
            <CardBody>
              <Text fontSize="lg" fontWeight="bold" mb={4}>
                Acciones Rápidas
              </Text>
              <VStack spacing={2} align="stretch">
                <Text fontSize="sm" color="gray.500">
                  • Revisar aportes pendientes
                </Text>
                <Text fontSize="sm" color="gray.500">
                  • Resolver pedidos
                </Text>
                <Text fontSize="sm" color="gray.500">
                  • Ver logs del sistema
                </Text>
                <Text fontSize="sm" color="gray.500">
                  • Configurar bot
                </Text>
              </VStack>
            </CardBody>
          </Card>
        </VStack>
      </Grid>
    </VStack>
  );
};
