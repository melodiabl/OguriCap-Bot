import React from 'react';
import {
  Box,
  Flex,
  IconButton,
  useDisclosure,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  VStack,
  Text,
  Button,
  HStack,
  Badge,
} from '@chakra-ui/react';
import { HamburgerIcon } from '@chakra-ui/icons';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Home,
  Bot,
  Users,
  MessageSquare,
  Package,
  ShoppingCart,
  Settings,
  LogOut,
  Activity,
  Bell,
  FileText,
  BarChart3,
  Image,
  Zap,
  Globe,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const menuItems = [
  { path: '/', icon: Home, label: 'Dashboard' },
  { path: '/bot', icon: Bot, label: 'Estado del Bot' },
  { path: '/usuarios', icon: Users, label: 'Usuarios' },
  { path: '/subbots', icon: Zap, label: 'SubBots' },
  { path: '/grupos', icon: MessageSquare, label: 'Grupos' },
  { path: '/grupos-management', icon: Globe, label: 'Gestión Global' },
  { path: '/aportes', icon: Package, label: 'Aportes' },
  { path: '/pedidos', icon: ShoppingCart, label: 'Pedidos' },
  { path: '/proveedores', icon: Users, label: 'Proveedores' },
  { path: '/logs', icon: FileText, label: 'Logs' },
  { path: '/notificaciones', icon: Bell, label: 'Notificaciones' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/multimedia', icon: Image, label: 'Multimedia' },
  { path: '/bot-commands', icon: Activity, label: 'Comandos' },
  { path: '/settings', icon: Settings, label: 'Configuración' },
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { user, logout } = useAuth();
  const location = useLocation();

  const Sidebar = () => (
    <VStack align="stretch" spacing={1} h="full">
      <Box p={4} borderBottom="1px" borderColor="gray.700">
        <Text fontSize="2xl" fontWeight="bold" color="blue.400">
          Oguri Bot
        </Text>
        <HStack mt={2}>
          <Badge colorScheme="green">{user?.rol || 'Usuario'}</Badge>
          <Text fontSize="sm" color="gray.400">
            {user?.username}
          </Text>
        </HStack>
      </Box>

      <VStack flex={1} align="stretch" spacing={0} overflowY="auto" p={2}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link key={item.path} to={item.path} onClick={onClose}>
              <Button
                w="full"
                justifyContent="flex-start"
                variant={isActive ? 'solid' : 'ghost'}
                colorScheme={isActive ? 'blue' : 'gray'}
                leftIcon={<Icon size={20} />}
                size="md"
                mb={1}
              >
                {item.label}
              </Button>
            </Link>
          );
        })}
      </VStack>

      <Box p={4} borderTop="1px" borderColor="gray.700">
        <Button
          w="full"
          leftIcon={<LogOut size={20} />}
          colorScheme="red"
          variant="ghost"
          onClick={logout}
        >
          Cerrar Sesión
        </Button>
      </Box>
    </VStack>
  );

  return (
    <Flex h="100vh" bg="gray.900">
      {/* Sidebar para desktop */}
      <Box
        w="280px"
        bg="gray.800"
        borderRight="1px"
        borderColor="gray.700"
        display={{ base: 'none', lg: 'block' }}
      >
        <Sidebar />
      </Box>

      {/* Drawer para mobile */}
      <Drawer isOpen={isOpen} placement="left" onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent bg="gray.800">
          <DrawerCloseButton color="white" />
          <DrawerHeader borderBottomWidth="1px" borderColor="gray.700">
            <Text color="white">Menú</Text>
          </DrawerHeader>
          <DrawerBody p={0}>
            <Sidebar />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Main content */}
      <Flex flex={1} direction="column" overflow="hidden">
        {/* Header */}
        <Flex
          h="60px"
          bg="gray.800"
          borderBottom="1px"
          borderColor="gray.700"
          align="center"
          px={4}
          gap={4}
        >
          <IconButton
            icon={<HamburgerIcon />}
            aria-label="Abrir menú"
            variant="ghost"
            display={{ base: 'flex', lg: 'none' }}
            onClick={onOpen}
          />
          <Text fontSize="xl" fontWeight="bold" color="white" flex={1}>
            {menuItems.find((item) => item.path === location.pathname)?.label || 'Panel'}
          </Text>
        </Flex>

        {/* Content area */}
        <Box flex={1} overflowY="auto" p={6}>
          {children}
        </Box>
      </Flex>
    </Flex>
  );
};
