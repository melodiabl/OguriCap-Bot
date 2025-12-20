import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardBody,
  VStack,
  HStack,
  Text,
  Button,
  Badge,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Image,
  Spinner,
  Alert,
  AlertIcon,
  Progress,
  Divider,
  Icon,
} from '@chakra-ui/react';
import {
  ChatIcon,
  CheckCircleIcon,
  WarningIcon,
  RepeatIcon,
  ViewIcon,
  LockIcon,
} from '@chakra-ui/icons';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { apiService, getBotStatus } from '../services/api';

interface BotStatus {
  status: 'connected' | 'connecting' | 'disconnected' | 'qr_ready';
  qrCode?: string;
  phone?: string;
  uptime?: string;
  lastActivity?: string;
  error?: string;
}

export const BotConnection: React.FC = () => {
  const [qrCode, setQrCode] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const queryClient = useQueryClient();

  // Obtener estado del bot
  const { data: botStatus, isLoading, refetch } = useQuery(
    ['botStatus'],
    async () => {
      try {
        const response = await getBotStatus();
        return response;
      } catch (error) {
        console.error('Error fetching bot status:', error);
        return null;
      }
    },
    {
      refetchInterval: 5000, // Actualizar cada 5 segundos
    }
  );

  // Obtener código QR
  const { data: qrData } = useQuery(
    ['botQR'],
    async () => {
      try {
        const response = await apiService.getBotQR();
        return response;
      } catch (error) {
        console.error('Error fetching QR code:', error);
        return null;
      }
    },
    {
      refetchInterval: 10000, // Actualizar cada 10 segundos
      enabled: connectionStatus === 'qr_ready',
    }
  );

  // Mutaciones
  const restartBotMutation = useMutation(
    async () => {
      return await apiService.restartBot();
    },
    {
      onSuccess: () => {
        toast({
          title: 'Bot reiniciado',
          description: 'El bot se está reiniciando...',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        queryClient.invalidateQueries(['botStatus']);
        queryClient.invalidateQueries(['botQR']);
      },
      onError: (error: any) => {
        toast({
          title: 'Error',
          description: error.message || 'Error al reiniciar el bot',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      },
    }
  );

  const disconnectBotMutation = useMutation(
    async () => {
      // TODO: Implementar endpoint para desconectar bot
      return await apiService.disconnectBot();
    },
    {
      onSuccess: () => {
        toast({
          title: 'Bot desconectado',
          description: 'El bot se ha desconectado',
          status: 'info',
          duration: 3000,
          isClosable: true,
        });
        queryClient.invalidateQueries(['botStatus']);
      },
      onError: (error: any) => {
        toast({
          title: 'Error',
          description: error.message || 'Error al desconectar el bot',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      },
    }
  );

  // Actualizar estado local cuando cambie el estado del bot
  useEffect(() => {
    if (botStatus) {
      setConnectionStatus(botStatus.status);
      if (botStatus.qrCode) {
        setQrCode(botStatus.qrCode);
      }
    }
  }, [botStatus]);

  // Actualizar código QR cuando cambie
  useEffect(() => {
    if (qrData && qrData.qrCode) {
      setQrCode(qrData.qrCode);
    }
  }, [qrData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'green';
      case 'connecting':
        return 'yellow';
      case 'qr_ready':
        return 'blue';
      case 'disconnected':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return 'Conectado';
      case 'connecting':
        return 'Conectando...';
      case 'qr_ready':
        return 'QR Listo';
      case 'disconnected':
        return 'Desconectado';
      default:
        return 'Desconocido';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return CheckCircleIcon;
      case 'connecting':
        return RepeatIcon;
      case 'qr_ready':
        return ViewIcon;
      case 'disconnected':
        return WarningIcon;
      default:
        return WarningIcon;
    }
  };

  const handleConnect = () => {
    if (connectionStatus === 'disconnected') {
      restartBotMutation.mutate();
    } else if (connectionStatus === 'qr_ready') {
      onOpen(); // Mostrar modal con QR
    }
  };

  const handleDisconnect = () => {
    if (connectionStatus === 'connected') {
      disconnectBotMutation.mutate();
    }
  };

  const handleRefresh = () => {
    refetch();
  };

  return (
    <Box>
      <Card>
        <CardBody>
          <VStack spacing={4} align="stretch">
            <HStack justify="space-between">
              <HStack>
                <Icon as={ChatIcon} color="green.500" boxSize={6} />
                <Text fontSize="lg" fontWeight="bold">
                  Estado del Bot de WhatsApp
                </Text>
              </HStack>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRefresh}
                isLoading={isLoading}
              >
                <Icon as={RepeatIcon} />
              </Button>
            </HStack>

            <Divider />

            {/* Estado del bot */}
            <HStack justify="space-between" p={4} bg="gray.50" borderRadius="md">
              <VStack align="start" spacing={1}>
                <Text fontSize="sm" color="gray.600">
                  Estado
                </Text>
                <HStack>
                  <Icon as={getStatusIcon(connectionStatus)} color={`${getStatusColor(connectionStatus)}.500`} />
                  <Badge colorScheme={getStatusColor(connectionStatus)} size="lg">
                    {getStatusText(connectionStatus)}
                  </Badge>
                </HStack>
              </VStack>

              <VStack align="end" spacing={1}>
                <Text fontSize="sm" color="gray.600">
                  Teléfono
                </Text>
                <Text fontWeight="medium">
                  {botStatus?.phone || 'No disponible'}
                </Text>
              </VStack>
            </HStack>

            {/* Información adicional */}
            {botStatus && (
              <HStack justify="space-between" p={4} bg="gray.50" borderRadius="md">
                <VStack align="start" spacing={1}>
                  <Text fontSize="sm" color="gray.600">
                    Tiempo activo
                  </Text>
                  <Text fontWeight="medium">
                    {botStatus.uptime || '0h 0m'}
                  </Text>
                </VStack>

                <VStack align="end" spacing={1}>
                  <Text fontSize="sm" color="gray.600">
                    Última actividad
                  </Text>
                  <Text fontWeight="medium">
                    {botStatus.lastActivity || 'Hace un momento'}
                  </Text>
                </VStack>
              </HStack>
            )}

            {/* Error si existe */}
            {botStatus?.error && (
              <Alert status="error">
                <AlertIcon />
                <Text fontSize="sm">{botStatus.error}</Text>
              </Alert>
            )}

            {/* Barra de progreso para estado connecting */}
            {connectionStatus === 'connecting' && (
              <Box>
                <Text fontSize="sm" mb={2}>
                  Conectando al bot...
                </Text>
                <Progress size="sm" isIndeterminate colorScheme="yellow" />
              </Box>
            )}

            {/* Acciones */}
            <HStack spacing={3} justify="center">
              {connectionStatus === 'disconnected' && (
                <Button
                  colorScheme="green"
                  leftIcon={<ChatIcon />}
                  onClick={handleConnect}
                  isLoading={restartBotMutation.isLoading}
                >
                  Conectar Bot
                </Button>
              )}

              {connectionStatus === 'qr_ready' && (
                <Button
                  colorScheme="blue"
                  leftIcon={<ViewIcon />}
                  onClick={handleConnect}
                >
                  Ver Código QR
                </Button>
              )}

              {connectionStatus === 'connected' && (
                <Button
                  colorScheme="red"
                  leftIcon={<LockIcon />}
                  onClick={handleDisconnect}
                  isLoading={disconnectBotMutation.isLoading}
                >
                  Desconectar
                </Button>
              )}

              {connectionStatus === 'connecting' && (
                <Button
                  colorScheme="yellow"
                  leftIcon={<RepeatIcon />}
                  onClick={handleRefresh}
                  isLoading={true}
                >
                  Conectando...
                </Button>
              )}
            </HStack>
          </VStack>
        </CardBody>
      </Card>

      {/* Modal para mostrar código QR */}
      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Conectar WhatsApp</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} pb={6}>
              <Text fontSize="sm" color="gray.600" textAlign="center">
                Escanea este código QR con tu WhatsApp para conectar el bot
              </Text>

              {qrCode ? (
                <Box textAlign="center">
                  <Image
                    src={qrCode}
                    alt="Código QR de WhatsApp"
                    maxW="300px"
                    mx="auto"
                  />
                  <Text fontSize="xs" color="gray.500" mt={2}>
                    El código se actualiza automáticamente
                  </Text>
                </Box>
              ) : (
                <Box textAlign="center" py={8}>
                  <Spinner size="xl" color="blue.500" />
                  <Text mt={2} color="gray.500">
                    Generando código QR...
                  </Text>
                </Box>
              )}

              <Text fontSize="xs" color="gray.500" textAlign="center">
                Mantén este modal abierto mientras escaneas el código
              </Text>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};
