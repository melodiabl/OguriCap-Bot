import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Avatar,
  Badge,
  useColorModeValue,
  Icon,
} from '@chakra-ui/react';
import { IconType } from 'react-icons';

interface ActivityItem {
  id: string;
  type: 'user' | 'group' | 'aporte' | 'pedido' | 'system';
  action: string;
  description: string;
  user?: string;
  timestamp: string;
  icon?: IconType;
  color?: string;
}

interface ActivityFeedWidgetProps {
  activities: ActivityItem[];
  title?: string;
  maxItems?: number;
}

export const ActivityFeedWidget: React.FC<ActivityFeedWidgetProps> = ({
  activities,
  title = 'Actividad Reciente',
  maxItems = 10,
}) => {
  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'user':
        return 'blue';
      case 'group':
        return 'green';
      case 'aporte':
        return 'purple';
      case 'pedido':
        return 'orange';
      case 'system':
        return 'gray';
      default:
        return 'blue';
    }
  };

  const getTypeIcon = (type: string) => {
    // Aquí podrías importar iconos específicos de react-icons
    return null;
  };

  const formatTimestamp = (timestamp: string) => {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffMs = now.getTime() - activityTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return activityTime.toLocaleDateString();
  };

  const displayedActivities = activities.slice(0, maxItems);

  return (
    <Box>
      {title && (
        <Text fontSize="lg" fontWeight="bold" mb={4}>
          {title}
        </Text>
      )}
      <VStack spacing={3} align="stretch">
        {displayedActivities.map((activity) => (
          <Box
            key={activity.id}
            p={3}
            bg={cardBg}
            border="1px"
            borderColor={borderColor}
            borderRadius="md"
            _hover={{ shadow: 'sm' }}
            transition="all 0.2s"
          >
            <HStack spacing={3} align="start">
              <Avatar
                size="sm"
                icon={activity.icon ? <Icon as={activity.icon} /> : undefined}
                bg={`${getTypeColor(activity.type)}.500`}
                name={activity.user || activity.action}
              />
              <VStack align="start" spacing={1} flex={1}>
                <HStack justify="space-between" w="full">
                  <Text fontSize="sm" fontWeight="medium">
                    {activity.action}
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    {formatTimestamp(activity.timestamp)}
                  </Text>
                </HStack>
                <Text fontSize="sm" color="gray.600">
                  {activity.description}
                </Text>
                <HStack spacing={2}>
                  <Badge size="sm" colorScheme={getTypeColor(activity.type)}>
                    {activity.type}
                  </Badge>
                  {activity.user && (
                    <Text fontSize="xs" color="gray.500">
                      por {activity.user}
                    </Text>
                  )}
                </HStack>
              </VStack>
            </HStack>
          </Box>
        ))}
        {activities.length === 0 && (
          <Box
            p={6}
            bg={cardBg}
            border="1px"
            borderColor={borderColor}
            borderRadius="md"
            textAlign="center"
          >
            <Text color="gray.500">No hay actividad reciente</Text>
          </Box>
        )}
      </VStack>
    </Box>
  );
};
