import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Icon,
  useColorMode,
  Flex,
  Divider,
  Badge,
  Button,
} from '@chakra-ui/react';
import {
  PhoneIcon,
  ViewIcon,
  ChatIcon,
  StarIcon,
  TimeIcon,
  SettingsIcon,
  BellIcon,
} from '@chakra-ui/icons';
import { Link, useLocation } from 'react-router-dom';

interface NavItem {
  label: string;
  icon: any;
  path: string;
  color: string;
  badge?: string;
  badgeColor?: string;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    icon: PhoneIcon,
    path: '/',
    color: 'blue',
  },
  {
    label: 'Usuarios',
    icon: ViewIcon,
    path: '/usuarios',
    color: 'green',
    badge: '3',
    badgeColor: 'green',
  },
  {
    label: 'Subbots',
    icon: SettingsIcon,
    path: '/subbots',
    color: 'blue',
    badge: '5',
    badgeColor: 'blue',
  },
  {
    label: 'Grupos',
    icon: ChatIcon,
    path: '/grupos',
    color: 'purple',
    badge: '12',
    badgeColor: 'purple',
  },
  {
    label: 'Gestión Grupos',
    icon: SettingsIcon,
    path: '/grupos-management',
    color: 'orange',
  },
  {
    label: 'Bot',
    icon: SettingsIcon,
    path: '/bot',
    color: 'orange',
  },
  {
    label: 'Aportes',
    icon: StarIcon,
    path: '/aportes',
    color: 'yellow',
    badge: '5',
    badgeColor: 'yellow',
  },
  {
    label: 'Pedidos',
    icon: ViewIcon,
    path: '/pedidos',
    color: 'teal',
    badge: '2',
    badgeColor: 'teal',
  },
  {
    label: 'Proveedores',
    icon: ChatIcon,
    path: '/proveedores',
    color: 'pink',
  },
  {
    label: 'Analytics',
    icon: ChatIcon,
    path: '/analytics',
    color: 'cyan',
  },
  {
    label: 'Logs',
    icon: TimeIcon,
    path: '/logs',
    color: 'gray',
  },
  {
    label: 'Notificaciones',
    icon: BellIcon,
    path: '/notificaciones',
    color: 'gray',
  },
  {
    label: 'AI Chat',
    icon: ChatIcon,
    path: '/ai-chat',
    color: 'purple',
  },
  {
    label: 'Bot Commands',
    icon: SettingsIcon,
    path: '/bot-commands',
    color: 'orange',
  },
  {
    label: 'Multimedia',
    icon: ViewIcon,
    path: '/multimedia',
    color: 'blue',
  },
];

export const Sidebar: React.FC = () => {
  const { colorMode } = useColorMode();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <Box
      bg={colorMode === 'dark' ? 'gray.800' : 'white'}
      borderRight="1px"
      borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.300'}
      w="280px"
      h="100vh"
      position="fixed"
      left={0}
      top={0}
      pt="80px"
      overflowY="auto"
      boxShadow="xl"
    >
      {/* Header del Sidebar */}
      <Box p={4} borderBottom="1px" borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}>
        <Text 
          fontSize="xl" 
          fontWeight="bold" 
          color={colorMode === 'dark' ? 'blue.300' : 'blue.600'}
          textAlign="center"
        >
          🤖 Oguri Bot
        </Text>
        <Text 
          fontSize="sm" 
          color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}
          textAlign="center"
          mt={1}
        >
          Panel de Control
        </Text>
      </Box>

      <VStack spacing={1} align="stretch" p={4}>
        {navItems.map((item) => (
          <Link key={item.path} to={item.path}>
            <Button
              w="full"
              h="auto"
              p={4}
              justifyContent="flex-start"
              variant={isActive(item.path) ? 'solid' : 'ghost'}
              colorScheme={isActive(item.path) ? item.color : undefined}
              bg={isActive(item.path) 
                ? `${item.color}.500` 
                : 'transparent'
              }
              color={isActive(item.path)
                ? 'white'
                : colorMode === 'dark' ? 'gray.200' : 'gray.700'
              }
              _hover={{
                bg: isActive(item.path)
                  ? `${item.color}.600`
                  : colorMode === 'dark' ? 'gray.700' : 'gray.100',
                transform: 'translateX(4px)',
                boxShadow: 'md',
              }}
              _active={{
                transform: 'translateX(2px)',
              }}
              borderRadius="lg"
              transition="all 0.2s"
              borderLeft={isActive(item.path)
                ? `4px solid`
                : '4px solid transparent'
              }
              borderLeftColor={isActive(item.path) ? `${item.color}.300` : 'transparent'}
            >
              <HStack justify="space-between" w="full">
                <HStack spacing={3}>
                  <Icon
                    as={item.icon}
                    boxSize={5}
                    color={isActive(item.path) 
                      ? 'white' 
                      : colorMode === 'dark' ? 'gray.300' : 'gray.600'
                    }
                  />
                  <Text 
                    fontWeight={isActive(item.path) ? 'bold' : 'medium'}
                    fontSize="sm"
                  >
                    {item.label}
                  </Text>
                </HStack>
                {item.badge && (
                  <Badge
                    colorScheme={item.badgeColor || item.color}
                    size="sm"
                    variant="solid"
                    borderRadius="full"
                    px={2}
                    py={1}
                    fontSize="xs"
                    fontWeight="bold"
                  >
                    {item.badge}
                  </Badge>
                )}
              </HStack>
            </Button>
          </Link>
        ))}
      </VStack>

      {/* Información del sistema */}
      <Box p={4} mt="auto" borderTop="1px" borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}>
        <VStack spacing={3} align="stretch">
          <HStack justify="space-between">
            <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
              Estado del Sistema
            </Text>
            <Badge colorScheme="green" size="sm" variant="solid">
              ✅ Activo
            </Badge>
          </HStack>
          <HStack justify="space-between">
            <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
              Versión
            </Text>
            <Text 
              fontSize="sm" 
              fontWeight="bold"
              color={colorMode === 'dark' ? 'white' : 'gray.800'}
            >
              v1.0.0
            </Text>
          </HStack>
          <HStack justify="space-between">
            <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
              Uptime
            </Text>
            <Text 
              fontSize="sm" 
              fontWeight="medium"
              color={colorMode === 'dark' ? 'green.300' : 'green.600'}
            >
              24h 15m
            </Text>
          </HStack>
        </VStack>
      </Box>
    </Box>
  );
};
