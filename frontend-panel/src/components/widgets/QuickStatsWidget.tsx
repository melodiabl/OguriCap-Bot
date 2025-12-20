import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  useColorModeValue,
  Icon,
} from '@chakra-ui/react';
import { IconType } from 'react-icons';

interface QuickStat {
  label: string;
  value: number | string;
  change?: number;
  changeType?: 'increase' | 'decrease';
  icon?: IconType;
  color?: string;
}

interface QuickStatsWidgetProps {
  stats: QuickStat[];
  title?: string;
  columns?: number;
}

export const QuickStatsWidget: React.FC<QuickStatsWidgetProps> = ({
  stats,
  title = 'Estadísticas Rápidas',
  columns = 4,
}) => {
  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  return (
    <Box>
      {title && (
        <Text fontSize="lg" fontWeight="bold" mb={4}>
          {title}
        </Text>
      )}
      <Box
        display="grid"
        gridTemplateColumns={`repeat(${columns}, 1fr)`}
        gap={4}
      >
        {stats.map((stat, index) => (
          <Box
            key={index}
            p={4}
            bg={cardBg}
            border="1px"
            borderColor={borderColor}
            borderRadius="lg"
            _hover={{ shadow: 'md' }}
            transition="all 0.2s"
          >
            <HStack spacing={3} align="start">
              {stat.icon && (
                <Icon
                  as={stat.icon}
                  boxSize={6}
                  color={stat.color || 'blue.500'}
                />
              )}
              <Stat>
                <StatLabel fontSize="sm" color="gray.500">
                  {stat.label}
                </StatLabel>
                <StatNumber fontSize="2xl" fontWeight="bold">
                  {typeof stat.value === 'number'
                    ? stat.value.toLocaleString()
                    : stat.value
                  }
                </StatNumber>
                {stat.change !== undefined && (
                  <StatHelpText>
                    <StatArrow
                      type={stat.changeType || (stat.change > 0 ? 'increase' : 'decrease')}
                    />
                    {Math.abs(stat.change)}%
                  </StatHelpText>
                )}
              </Stat>
            </HStack>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
