import React from 'react';
import {
  Box,
  Text,
  Select,
  FormControl,
  FormLabel,
  VStack,
  HStack,
  Badge,
  IconButton,
  Tooltip,
  useToast
} from '@chakra-ui/react';
import { AddIcon, DeleteIcon } from '@chakra-ui/icons';
import { apiService } from '../services/api';

interface RoleSelectorProps {
  selectedRoles: string[];
  onRolesChange: (roles: string[]) => void;
  isEditable?: boolean;
  label?: string;
}

const AVAILABLE_ROLES = [
  { value: 'owner', label: 'Propietario', color: 'red', description: 'Acceso total al sistema' },
  { value: 'admin', label: 'Administrador', color: 'orange', description: 'Gestión de grupos y usuarios' },
  { value: 'moderator', label: 'Moderador', color: 'yellow', description: 'Moderación de contenido' },
  { value: 'member', label: 'Miembro', color: 'green', description: 'Acceso básico' },
  { value: 'viewer', label: 'Visualizador', color: 'blue', description: 'Solo lectura' },
  { value: 'guest', label: 'Invitado', color: 'gray', description: 'Acceso limitado' }
];

export const RoleSelector: React.FC<RoleSelectorProps> = ({
  selectedRoles,
  onRolesChange,
  isEditable = true,
  label = 'Roles del Usuario'
}) => {
  const toast = useToast();

  const handleAddRole = (roleValue: string) => {
    if (!selectedRoles.includes(roleValue)) {
      const newRoles = [...selectedRoles, roleValue];
      onRolesChange(newRoles);
      toast({
        title: 'Rol agregado',
        description: `Se agregó el rol "${AVAILABLE_ROLES.find(r => r.value === roleValue)?.label}"`,
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    }
  };

  const handleRemoveRole = (roleToRemove: string) => {
    const newRoles = selectedRoles.filter(role => role !== roleToRemove);
    onRolesChange(newRoles);
    toast({
      title: 'Rol removido',
      description: `Se removió el rol "${AVAILABLE_ROLES.find(r => r.value === roleToRemove)?.label}"`,
      status: 'info',
      duration: 2000,
      isClosable: true,
    });
  };

  const getRoleInfo = (roleValue: string) => {
    return AVAILABLE_ROLES.find(role => role.value === roleValue);
  };

  return (
    <Box>
      <FormLabel>{label}</FormLabel>

      {isEditable && (
        <HStack mb={4} spacing={2}>
          <Select
            placeholder="Seleccionar rol"
            onChange={(e) => handleAddRole(e.target.value)}
            value=""
            maxW="300px"
          >
            {AVAILABLE_ROLES
              .filter(role => !selectedRoles.includes(role.value))
              .map(role => (
                <option key={role.value} value={role.value}>
                  {role.label} - {role.description}
                </option>
              ))}
          </Select>
        </HStack>
      )}

      <VStack align="start" spacing={2}>
        {selectedRoles.length === 0 ? (
          <Text color="gray.500" fontSize="sm">
            No hay roles asignados
          </Text>
        ) : (
          selectedRoles.map(role => {
            const roleInfo = getRoleInfo(role);
            return (
              <HStack key={role} spacing={2}>
                <Badge colorScheme={roleInfo?.color || 'gray'} variant="solid">
                  {roleInfo?.label || role}
                </Badge>
                <Text fontSize="sm" color="gray.600">
                  {roleInfo?.description}
                </Text>
                {isEditable && (
                  <Tooltip label="Remover rol">
                    <IconButton
                      aria-label="Remover rol"
                      icon={<DeleteIcon />}
                      size="sm"
                      variant="ghost"
                      colorScheme="red"
                      onClick={() => handleRemoveRole(role)}
                    />
                  </Tooltip>
                )}
              </HStack>
            );
          })
        )}
      </VStack>

      <Box mt={4} p={3} bg="gray.50" borderRadius="md">
        <Text fontSize="sm" fontWeight="medium" mb={2}>
          Roles Disponibles:
        </Text>
        <HStack wrap="wrap" spacing={2}>
          {AVAILABLE_ROLES.map(role => (
            <Tooltip key={role.value} label={role.description}>
              <Badge
                colorScheme={role.color}
                variant={selectedRoles.includes(role.value) ? 'solid' : 'outline'}
                cursor="default"
              >
                {role.label}
              </Badge>
            </Tooltip>
          ))}
        </HStack>
      </Box>
    </Box>
  );
};
