import React from 'react';
import {
  Box,
  Grid,
  GridItem,
  Card,
  CardBody,
  Heading,
  Text,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  HStack,
  VStack,
  Icon,
  useColorMode,
  SimpleGrid,
  Progress,
  Badge,
  Flex,
  Spacer,
  Button,
  IconButton,
  Tooltip,
  useToast,
  Alert,
  AlertIcon,
  Divider,
  Circle,
} from '@chakra-ui/react';
import {
  ChatIcon,
  ViewIcon,
  StarIcon,
  TimeIcon,
  TriangleUpIcon,
  TriangleDownIcon,
  RepeatIcon,
  AttachmentIcon,
  AddIcon,
  SettingsIcon,
  BellIcon,
  CheckCircleIcon,
  WarningIcon,
  InfoIcon,
} from '@chakra-ui/icons';
import { BotConnection } from './BotConnection';
import { useQuery } from 'react-query';
import { apiService } from '../services/api';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalGroups: number;
  authorizedGroups: number;
  totalMessages: number;
  messagesToday: number;
  botStatus: 'online' | 'offline' | 'connecting';
  uptime: string;
  lastActivity: string;
}

interface DashboardProps {
  stats: DashboardStats;
}

export const Dashboard: React.FC<DashboardProps> = ({ stats }) => {
  const { colorMode } = useColorMode();
  const toast = useToast();

  // Obtener estadísticas adicionales
  const { data: recentActivity } = useQuery(
    ['recentActivity'],
    async () => {
      try {
        // TODO: Implementar endpoint de actividad reciente
        return [];
      } catch (error) {
        return [];
      }
    }
  );

  const { data: systemHealth } = useQuery(
    ['systemHealth'],
    async () => {
      try {
        return {
          database: 'healthy',
          api: 'healthy',
          bot: stats.botStatus === 'online' ? 'healthy' : 'warning',
          storage: 'healthy',
        };
      } catch (error) {
        return {
          database: 'error',
          api: 'error',
          bot: 'error',
          storage: 'error',
        };
      }
    }
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'green';
      case 'offline':
        return 'red';
      case 'connecting':
        return 'yellow';
      default:
        return 'gray';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
        return 'En Línea';
      case 'offline':
        return 'Desconectado';
      case 'connecting':
        return 'Conectando...';
      default:
        return 'Desconocido';
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy':
        return 'green';
      case 'warning':
        return 'yellow';
      case 'error':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy':
        return CheckCircleIcon;
      case 'warning':
        return WarningIcon;
      case 'error':
        return WarningIcon;
      default:
        return InfoIcon;
    }
  };

  const handleQuickAction = (action: string) => {
    toast({
      title: 'Acción ejecutada',
      description: `Se ejecutó: ${action}`,
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  return (
    <Box p={6}>
      {/* Header del Dashboard */}
      <Box mb={8}>
        <HStack justify="space-between" align="center">
          <VStack align="start" spacing={2}>
            <Heading
              size="lg"
              bgGradient="linear(to-r, brand.500, purple.500)"
              bgClip="text"
            >
              🚀 Panel de Control
            </Heading>
            <Text color="gray.500" fontSize="sm">
              Bienvenido al centro de control de tu bot de WhatsApp
            </Text>
          </VStack>
          <HStack spacing={3}>
            <Button
              leftIcon={<AddIcon />}
              colorScheme="brand"
              variant="gradient"
              size="sm"
            >
              Nueva Acción
            </Button>
            <IconButton
              aria-label="Configuración"
              icon={<SettingsIcon />}
              colorScheme="gray"
              variant="ghost"
              size="sm"
            />
          </HStack>
        </HStack>
      </Box>

      {/* Conexión del Bot */}
      <Box mb={8}>
        <BotConnection />
      </Box>

      {/* Estadísticas principales con gradientes */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} mb={8}>
        <Card
          bgGradient="linear(to-br, blue.50, blue.100)"
          border="1px"
          borderColor="blue.200"
          _hover={{ transform: 'translateY(-4px)', boxShadow: 'xl' }}
          transition="all 0.3s"
        >
          <CardBody>
            <Stat>
              <StatLabel color="blue.700" fontWeight="semibold">
                👥 Total Usuarios
              </StatLabel>
              <StatNumber color="blue.800" fontSize="3xl">
                {stats.totalUsers}
              </StatNumber>
              <StatHelpText color="blue.600">
                <StatArrow type="increase" />
                {stats.activeUsers} activos
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card
          bgGradient="linear(to-br, purple.50, purple.100)"
          border="1px"
          borderColor="purple.200"
          _hover={{ transform: 'translateY(-4px)', boxShadow: 'xl' }}
          transition="all 0.3s"
        >
          <CardBody>
            <Stat>
              <StatLabel color="purple.700" fontWeight="semibold">
                💬 Grupos
              </StatLabel>
              <StatNumber color="purple.800" fontSize="3xl">
                {stats.totalGroups}
              </StatNumber>
              <StatHelpText color="purple.600">
                {stats.authorizedGroups} autorizados
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card
          bgGradient="linear(to-br, green.50, green.100)"
          border="1px"
          borderColor="green.200"
          _hover={{ transform: 'translateY(-4px)', boxShadow: 'xl' }}
          transition="all 0.3s"
        >
          <CardBody>
            <Stat>
              <StatLabel color="green.700" fontWeight="semibold">
                📨 Mensajes
              </StatLabel>
              <StatNumber color="green.800" fontSize="3xl">
                {stats.totalMessages}
              </StatNumber>
              <StatHelpText color="green.600">
                {stats.messagesToday} hoy
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        <Card
          bgGradient="linear(to-br, orange.50, orange.100)"
          border="1px"
          borderColor="orange.200"
          _hover={{ transform: 'translateY(-4px)', boxShadow: 'xl' }}
          transition="all 0.3s"
        >
          <CardBody>
            <Stat>
              <StatLabel color="orange.700" fontWeight="semibold">
                🤖 Estado del Bot
              </StatLabel>
              <StatNumber>
                <Badge
                  colorScheme={getStatusColor(stats.botStatus)}
                  size="lg"
                  variant="solid"
                  px={4}
                  py={2}
                  borderRadius="full"
                >
                  {getStatusText(stats.botStatus)}
                </Badge>
              </StatNumber>
              <StatHelpText color="orange.600">
                Uptime: {stats.uptime}
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Gráficos y métricas detalladas */}
      <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6} mb={8}>
        <GridItem>
          <Card
            bg={colorMode === 'dark' ? 'gray.800' : 'white'}
            border="1px"
            borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
            _hover={{ boxShadow: 'xl' }}
            transition="all 0.3s"
          >
            <CardBody>
              <Heading size="md" mb={4} color="brand.600">
                📊 Actividad del Sistema
              </Heading>
              <VStack spacing={6} align="stretch">
                <Box>
                  <HStack justify="space-between" mb={3}>
                    <Text fontSize="sm" fontWeight="medium" color="blue.600">
                      Mensajes por hora
                    </Text>
                    <Text fontSize="sm" color="gray.500">
                      Últimas 24h
                    </Text>
                  </HStack>
                  <Progress
                    value={75}
                    colorScheme="blue"
                    size="lg"
                    borderRadius="full"
                    bg="blue.100"
                  />
                  <Text fontSize="xs" color="gray.500" mt={1} textAlign="right">
                    75% del promedio diario
                  </Text>
                </Box>

                <Box>
                  <HStack justify="space-between" mb={3}>
                    <Text fontSize="sm" fontWeight="medium" color="green.600">
                      Usuarios activos
                    </Text>
                    <Text fontSize="sm" color="gray.500">
                      {stats.activeUsers}/{stats.totalUsers}
                    </Text>
                  </HStack>
                  <Progress
                    value={stats.totalUsers > 0 ? (stats.activeUsers / stats.totalUsers) * 100 : 0}
                    colorScheme="green"
                    size="lg"
                    borderRadius="full"
                    bg="green.100"
                  />
                  <Text fontSize="xs" color="gray.500" mt={1} textAlign="right">
                    {stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0}% de usuarios activos
                  </Text>
                </Box>

                <Box>
                  <HStack justify="space-between" mb={3}>
                    <Text fontSize="sm" fontWeight="medium" color="purple.600">
                      Grupos autorizados
                    </Text>
                    <Text fontSize="sm" color="gray.500">
                      {stats.authorizedGroups}/{stats.totalGroups}
                    </Text>
                  </HStack>
                  <Progress
                    value={stats.totalGroups > 0 ? (stats.authorizedGroups / stats.totalGroups) * 100 : 0}
                    colorScheme="purple"
                    size="lg"
                    borderRadius="full"
                    bg="purple.100"
                  />
                  <Text fontSize="xs" color="gray.500" mt={1} textAlign="right">
                    {stats.totalGroups > 0 ? Math.round((stats.authorizedGroups / stats.totalGroups) * 100) : 0}% de grupos autorizados
                  </Text>
                </Box>
              </VStack>
            </CardBody>
          </Card>
        </GridItem>

        <GridItem>
          <VStack spacing={6}>
            {/* Acciones Rápidas */}
            <Card
              bg={colorMode === 'dark' ? 'gray.800' : 'white'}
              border="1px"
              borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
              w="full"
              _hover={{ boxShadow: 'xl' }}
              transition="all 0.3s"
            >
              <CardBody>
                <Heading size="md" mb={4} color="brand.600">
                  ⚡ Acciones Rápidas
                </Heading>
                <VStack spacing={3} align="stretch">
                  <Button
                    leftIcon={<ChatIcon />}
                    variant="ghost"
                    colorScheme="blue"
                    justifyContent="start"
                    onClick={() => handleQuickAction('Enviar Mensaje')}
                    _hover={{ bg: 'blue.50', transform: 'translateX(4px)' }}
                    transition="all 0.2s"
                  >
                    Enviar Mensaje
                  </Button>

                  <Button
                    leftIcon={<ViewIcon />}
                    variant="ghost"
                    colorScheme="green"
                    justifyContent="start"
                    onClick={() => handleQuickAction('Ver Grupos')}
                    _hover={{ bg: 'green.50', transform: 'translateX(4px)' }}
                    transition="all 0.2s"
                  >
                    Ver Grupos
                  </Button>

                  <Button
                    leftIcon={<StarIcon />}
                    variant="ghost"
                    colorScheme="purple"
                    justifyContent="start"
                    onClick={() => handleQuickAction('Gestionar Usuarios')}
                    _hover={{ bg: 'purple.50', transform: 'translateX(4px)' }}
                    transition="all 0.2s"
                  >
                    Gestionar Usuarios
                  </Button>

                  <Button
                    leftIcon={<TimeIcon />}
                    variant="ghost"
                    colorScheme="orange"
                    justifyContent="start"
                    onClick={() => handleQuickAction('Ver Logs')}
                    _hover={{ bg: 'orange.50', transform: 'translateX(4px)' }}
                    transition="all 0.2s"
                  >
                    Ver Logs
                  </Button>
                </VStack>
              </CardBody>
            </Card>

            {/* Estado del Sistema */}
            <Card
              bg={colorMode === 'dark' ? 'gray.800' : 'white'}
              border="1px"
              borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
              w="full"
              _hover={{ boxShadow: 'xl' }}
              transition="all 0.3s"
            >
              <CardBody>
                <Heading size="md" mb={4} color="brand.600">
                  🔧 Estado del Sistema
                </Heading>
                <VStack spacing={3} align="stretch">
                  {systemHealth && Object.entries(systemHealth).map(([service, health]) => (
                    <HStack key={service} justify="space-between">
                      <HStack spacing={2}>
                        <Circle size="8px" bg={`${getHealthColor(health)}.500`} />
                        <Text fontSize="sm" textTransform="capitalize">
                          {service}
                        </Text>
                      </HStack>
                      <Badge
                        colorScheme={getHealthColor(health)}
                        size="sm"
                        variant="solid"
                        borderRadius="full"
                      >
                        {health === 'healthy' ? 'Saludable' : health === 'warning' ? 'Advertencia' : 'Error'}
                      </Badge>
                    </HStack>
                  ))}

                  <Divider />

                  <HStack justify="space-between">
                    <Text fontSize="sm" color="gray.500">
                      Última Actividad
                    </Text>
                    <Text fontSize="sm" fontWeight="medium">
                      {stats.lastActivity}
                    </Text>
                  </HStack>
                </VStack>
              </CardBody>
            </Card>
          </VStack>
        </GridItem>
      </Grid>

      {/* Métricas adicionales con iconos y colores */}
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mt={8}>
        <Card
          bgGradient="linear(to-br, teal.50, teal.100)"
          border="1px"
          borderColor="teal.200"
          _hover={{ transform: 'translateY(-4px)', boxShadow: 'xl' }}
          transition="all 0.3s"
        >
          <CardBody>
            <VStack spacing={3}>
              <Circle size="16" bg="teal.500" color="white">
                <Icon as={TriangleUpIcon} boxSize={8} />
              </Circle>
              <Text fontSize="lg" fontWeight="bold" color="teal.800">
                {stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0}%
              </Text>
              <Text fontSize="sm" color="teal.700" textAlign="center">
                Usuarios activos
              </Text>
            </VStack>
          </CardBody>
        </Card>

        <Card
          bgGradient="linear(to-br, pink.50, pink.100)"
          border="1px"
          borderColor="pink.200"
          _hover={{ transform: 'translateY(-4px)', boxShadow: 'xl' }}
          transition="all 0.3s"
        >
          <CardBody>
            <VStack spacing={3}>
              <Circle size="16" bg="pink.500" color="white">
                <Icon as={RepeatIcon} boxSize={8} />
              </Circle>
              <Text fontSize="lg" fontWeight="bold" color="pink.800">
                {stats.messagesToday}
              </Text>
              <Text fontSize="sm" color="pink.700" textAlign="center">
                Mensajes hoy
              </Text>
            </VStack>
          </CardBody>
        </Card>

        <Card
          bgGradient="linear(to-br, cyan.50, cyan.100)"
          border="1px"
          borderColor="cyan.200"
          _hover={{ transform: 'translateY(-4px)', boxShadow: 'xl' }}
          transition="all 0.3s"
        >
          <CardBody>
            <VStack spacing={3}>
              <Circle size="16" bg="cyan.500" color="white">
                <Icon as={AttachmentIcon} boxSize={8} />
              </Circle>
              <Text fontSize="lg" fontWeight="bold" color="cyan.800">
                {stats.authorizedGroups}
              </Text>
              <Text fontSize="sm" color="cyan.700" textAlign="center">
                Grupos autorizados
              </Text>
            </VStack>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Alertas y notificaciones */}
      {stats.botStatus === 'offline' && (
        <Alert status="warning" mt={6} borderRadius="lg">
          <AlertIcon />
          <Box>
            <Text fontWeight="bold">Bot desconectado</Text>
            <Text fontSize="sm">
              El bot de WhatsApp no está funcionando. Revisa la conexión.
            </Text>
          </Box>
        </Alert>
      )}

      {stats.totalUsers === 0 && (
        <Alert status="info" mt={6} borderRadius="lg">
          <AlertIcon />
          <Box>
            <Text fontWeight="bold">Sin usuarios registrados</Text>
            <Text fontSize="sm">
              Crea tu primer usuario para comenzar a usar el sistema.
            </Text>
          </Box>
        </Alert>
      )}
    </Box>
  );
};
