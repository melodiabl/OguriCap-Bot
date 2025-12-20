import React from 'react';
import {
  Box,
  Flex,
  HStack,
  Button,
  IconButton,
  useColorMode,
  Text,
  Avatar,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  useDisclosure,
  useToast,
  Badge,
} from '@chakra-ui/react';
import {
  SunIcon,
  MoonIcon,
  BellIcon,
  SettingsIcon,
  RepeatIcon,
  ViewIcon,
} from '@chakra-ui/icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  onMenuClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { colorMode, toggleColorMode } = useColorMode();
  const { user, logout, clearAuthData } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast({
      title: 'Sesión cerrada',
      description: 'Has cerrado sesión exitosamente',
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'red';
      case 'admin':
        return 'orange';
      case 'moderator':
        return 'yellow';
      case 'member':
        return 'green';
      case 'viewer':
        return 'blue';
      case 'guest':
        return 'gray';
      default:
        return 'gray';
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'owner':
        return 'Propietario';
      case 'admin':
        return 'Administrador';
      case 'moderator':
        return 'Moderador';
      case 'member':
        return 'Miembro';
      case 'viewer':
        return 'Visualizador';
      case 'guest':
        return 'Invitado';
      default:
        return role;
    }
  };

  return (
    <Box
      bg={colorMode === 'dark' ? 'gray.800' : 'white'}
      borderBottom="1px"
      borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
      px={4}
      py={3}
      position="sticky"
      top={0}
      zIndex={1000}
      boxShadow="sm"
    >
      <Flex h={16} alignItems="center" justifyContent="space-between">
        {/* Logo y título */}
        <HStack spacing={4}>
          <Box
            bgGradient="linear(to-r, brand.400, purple.400)"
            borderRadius="full"
            p={2}
            boxShadow="lg"
          >
            <Text
              fontSize="xl"
              fontWeight="bold"
              color="white"
              textShadow="0 1px 2px rgba(0,0,0,0.3)"
            >
              WA
            </Text>
          </Box>
          <Text
            fontSize="xl"
            fontWeight="bold"
            bgGradient="linear(to-r, brand.500, purple.500)"
            bgClip="text"
          >
            WhatsApp Bot
          </Text>
        </HStack>

        {/* Acciones del usuario */}
        <HStack spacing={4}>
          {/* Notificaciones */}
          <IconButton
            aria-label="Notificaciones"
            icon={<BellIcon />}
            variant="ghost"
            colorScheme="gray"
            size="md"
            position="relative"
            onClick={() => navigate('/notificaciones')}
          >
            <Badge
              colorScheme="red"
              position="absolute"
              top={1}
              right={1}
              borderRadius="full"
              size="sm"
            >
              3
            </Badge>
          </IconButton>

          {/* Cambio de tema */}
          <IconButton
            aria-label="Cambiar tema"
            icon={colorMode === 'dark' ? <SunIcon /> : <MoonIcon />}
            onClick={toggleColorMode}
            variant="ghost"
            colorScheme="gray"
            size="md"
            _hover={{
              bg: colorMode === 'dark' ? 'yellow.100' : 'purple.100',
              color: colorMode === 'dark' ? 'yellow.600' : 'purple.600',
            }}
          />

          {/* Configuración */}
          <IconButton
            aria-label="Configuración"
            icon={<SettingsIcon />}
            variant="ghost"
            colorScheme="gray"
            size="md"
            onClick={() => navigate('/settings')}
          />

          {/* Menú del usuario */}
          <Menu>
            <MenuButton
              as={Button}
              variant="ghost"
              size="md"
              px={3}
              py={2}
              _hover={{
                bg: colorMode === 'dark' ? 'gray.700' : 'gray.100',
              }}
            >
              <HStack spacing={3}>
                <Avatar
                  size="sm"
                  name={user?.username}
                  bg={colorMode === 'dark' ? 'brand.400' : 'brand.500'}
                />
                <Box textAlign="left">
                  <Text fontWeight="medium" fontSize="sm">
                    {user?.username}
                  </Text>
                  {user?.roles && user.roles.length > 0 && (
                    <Badge
                      colorScheme={getRoleColor(user.roles[0])}
                      size="xs"
                      variant="solid"
                    >
                      {getRoleText(user.roles[0])}
                    </Badge>
                  )}
                </Box>
              </HStack>
            </MenuButton>
            <MenuList
              bg={colorMode === 'dark' ? 'gray.800' : 'white'}
              borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
            >
              <MenuItem
                icon={<ViewIcon />}
                _hover={{
                  bg: colorMode === 'dark' ? 'gray.700' : 'gray.100',
                }}
              >
                Perfil
              </MenuItem>
              <MenuItem
                icon={<SettingsIcon />}
                _hover={{
                  bg: colorMode === 'dark' ? 'gray.700' : 'gray.100',
                }}
              >
                Configuración
              </MenuItem>
              <MenuDivider />
              <MenuItem
                icon={<RepeatIcon />}
                onClick={clearAuthData}
                _hover={{
                  bg: colorMode === 'dark' ? 'orange.700' : 'orange.50',
                  color: colorMode === 'dark' ? 'white' : 'orange.600',
                }}
              >
                Limpiar Auth (Debug)
              </MenuItem>
              <MenuItem
                icon={<RepeatIcon />}
                onClick={handleLogout}
                _hover={{
                  bg: colorMode === 'dark' ? 'red.700' : 'red.50',
                  color: colorMode === 'dark' ? 'white' : 'red.600',
                }}
              >
                Cerrar Sesión
              </MenuItem>
            </MenuList>
          </Menu>
        </HStack>
      </Flex>
    </Box>
  );
};
