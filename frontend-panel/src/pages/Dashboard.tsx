import React, { useEffect, useState } from 'react';
import {
  Box,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Card,
  CardBody,
  Heading,
  Text,
  VStack,
  Spinner,
  Center,
} from '@chakra-ui/react';
import { Users, MessageSquare, Package, ShoppingCart, Bot as BotIcon } from 'lucide-react';
import api from '../config/api';

interface DashboardStats {
  totalUsuarios: number;
  totalGrupos: number;
  totalAportes: number;
  totalPedidos: number;
  totalSubbots: number;
  mensajesHoy: number;
  comandosHoy: number;
  usuariosActivos: number;
  gruposActivos: number;
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await api.get('/dashboard/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Center h="60vh">
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" />
          <Text color="gray.400">Cargando estadísticas...</Text>
        </VStack>
      </Center>
    );
  }

  const statCards = [
    {
      label: 'Usuarios Totales',
      value: stats?.totalUsuarios || 0,
      icon: Users,
      color: 'blue',
      helpText: `${stats?.usuariosActivos || 0} activos hoy`,
    },
    {
      label: 'Grupos Totales',
      value: stats?.totalGrupos || 0,
      icon: MessageSquare,
      color: 'green',
      helpText: `${stats?.gruposActivos || 0} activos`,
    },
    {
      label: 'Aportes',
      value: stats?.totalAportes || 0,
      icon: Package,
      color: 'purple',
      helpText: 'Total de aportes',
    },
    {
      label: 'Pedidos',
      value: stats?.totalPedidos || 0,
      icon: ShoppingCart,
      color: 'orange',
      helpText: 'Total de pedidos',
    },
    {
      label: 'SubBots',
      value: stats?.totalSubbots || 0,
      icon: BotIcon,
      color: 'cyan',
      helpText: 'Instancias activas',
    },
  ];

  return (
    <VStack spacing={6} align="stretch">
      <Box>
        <Heading size="lg" mb={2} color="white">
          Dashboard
        </Heading>
        <Text color="gray.400">Vista general del sistema</Text>
      </Box>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} bg="gray.800" borderColor="gray.700" borderWidth={1}>
              <CardBody>
                <Stat>
                  <StatLabel color="gray.400" fontSize="sm" mb={2}>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Icon size={18} />
                      {stat.label}
                    </Box>
                  </StatLabel>
                  <StatNumber color="white" fontSize="3xl">
                    {stat.value}
                  </StatNumber>
                  <StatHelpText color="gray.500">{stat.helpText}</StatHelpText>
                </Stat>
              </CardBody>
            </Card>
          );
        })}
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
        <Card bg="gray.800" borderColor="gray.700" borderWidth={1}>
          <CardBody>
            <Heading size="md" mb={4} color="white">
              Actividad de Hoy
            </Heading>
            <VStack align="stretch" spacing={3}>
              <Box display="flex" justifyContent="space-between">
                <Text color="gray.400">Mensajes Procesados</Text>
                <Text color="white" fontWeight="bold">
                  {stats?.mensajesHoy || 0}
                </Text>
              </Box>
              <Box display="flex" justifyContent="space-between">
                <Text color="gray.400">Comandos Ejecutados</Text>
                <Text color="white" fontWeight="bold">
                  {stats?.comandosHoy || 0}
                </Text>
              </Box>
              <Box display="flex" justifyContent="space-between">
                <Text color="gray.400">Usuarios Activos</Text>
                <Text color="white" fontWeight="bold">
                  {stats?.usuariosActivos || 0}
                </Text>
              </Box>
            </VStack>
          </CardBody>
        </Card>

        <Card bg="gray.800" borderColor="gray.700" borderWidth={1}>
          <CardBody>
            <Heading size="md" mb={4} color="white">
              Estado del Sistema
            </Heading>
            <VStack align="stretch" spacing={3}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Text color="gray.400">Estado del Bot</Text>
                <Box bg="green.500" px={3} py={1} borderRadius="full">
                  <Text color="white" fontSize="sm" fontWeight="bold">
                    Conectado
                  </Text>
                </Box>
              </Box>
              <Box display="flex" justifyContent="space-between">
                <Text color="gray.400">Grupos Activos</Text>
                <Text color="white" fontWeight="bold">
                  {stats?.gruposActivos || 0}
                </Text>
              </Box>
              <Box display="flex" justifyContent="space-between">
                <Text color="gray.400">SubBots Online</Text>
                <Text color="white" fontWeight="bold">
                  {stats?.totalSubbots || 0}
                </Text>
              </Box>
            </VStack>
          </CardBody>
        </Card>
      </SimpleGrid>
    </VStack>
  );
};

export default Dashboard;
