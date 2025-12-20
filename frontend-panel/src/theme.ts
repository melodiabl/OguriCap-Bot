import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
};

const colors = {
  brand: {
    50: '#E6F6FF',
    100: '#BAE3FF',
    200: '#7CC4FA',
    300: '#47A3F3',
    400: '#2186EB',
    500: '#0967D2',
    600: '#0552B5',
    700: '#03449E',
    800: '#01337D',
    900: '#002159',
  },
  accent: {
    50: '#F0FFF4',
    100: '#C6F6D5',
    200: '#9AE6B4',
    300: '#68D391',
    400: '#48BB78',
    500: '#38A169',
    600: '#2F855A',
    700: '#276749',
    800: '#22543D',
    900: '#1C4532',
  },
  purple: {
    50: '#FAF5FF',
    100: '#E9D8FD',
    200: '#D6BCFA',
    300: '#B794F4',
    400: '#9F7AEA',
    500: '#805AD5',
    600: '#6B46C1',
    700: '#553C9A',
    800: '#44337A',
    900: '#322659',
  },
  orange: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
  },
  pink: {
    50: '#FDF2F8',
    100: '#FCE7F3',
    200: '#FBCFE8',
    300: '#F9A8D4',
    400: '#F472B6',
    500: '#EC4899',
    600: '#DB2777',
    700: '#BE185D',
    800: '#9D174D',
    900: '#831843',
  },
  teal: {
    50: '#F0FDFA',
    100: '#CCFBF1',
    200: '#99F6E4',
    300: '#5EEAD4',
    400: '#2DD4BF',
    500: '#14B8A6',
    600: '#0D9488',
    700: '#0F766E',
    800: '#115E59',
    900: '#134E4A',
  },
};

const components = {
  Button: {
    defaultProps: {
      colorScheme: 'brand',
    },
    variants: {
      solid: {
        bg: 'brand.500',
        color: 'white',
        _hover: {
          bg: 'brand.600',
          transform: 'translateY(-1px)',
          boxShadow: 'lg',
        },
        _active: {
          bg: 'brand.700',
          transform: 'translateY(0)',
        },
      },
      ghost: (props: any) => ({
        color: props.colorMode === 'dark' ? 'gray.200' : 'gray.700',
        _hover: {
          bg: props.colorMode === 'dark' ? 'gray.700' : 'gray.100',
          color: props.colorMode === 'dark' ? 'white' : 'gray.900',
        },
      }),
      outline: (props: any) => ({
        borderColor: props.colorMode === 'dark' ? 'gray.600' : 'gray.300',
        color: props.colorMode === 'dark' ? 'gray.200' : 'gray.700',
        _hover: {
          bg: props.colorMode === 'dark' ? 'gray.700' : 'gray.50',
          borderColor: props.colorMode === 'dark' ? 'gray.500' : 'gray.400',
        },
      }),
      gradient: {
        bgGradient: 'linear(to-r, brand.400, purple.400)',
        color: 'white',
        _hover: {
          bgGradient: 'linear(to-r, brand.500, purple.500)',
          transform: 'translateY(-1px)',
          boxShadow: 'lg',
        },
      },
    },
  },
  Card: {
    baseStyle: (props: any) => ({
      container: {
        borderRadius: 'xl',
        boxShadow: props.colorMode === 'dark' ? 'dark-lg' : 'lg',
        bg: props.colorMode === 'dark' ? 'gray.800' : 'white',
        borderWidth: '1px',
        borderColor: props.colorMode === 'dark' ? 'gray.700' : 'gray.200',
        _hover: {
          boxShadow: props.colorMode === 'dark' ? 'dark-xl' : 'xl',
          transform: 'translateY(-2px)',
          transition: 'all 0.2s',
        },
      },
    }),
  },
  Badge: {
    variants: {
      solid: {
        borderRadius: 'full',
        px: 3,
        py: 1,
        fontWeight: 'bold',
      },
    },
  },
  Text: {
    baseStyle: (props: any) => ({
      color: props.colorMode === 'dark' ? 'gray.100' : 'gray.800',
    }),
  },
  Heading: {
    baseStyle: (props: any) => ({
      color: props.colorMode === 'dark' ? 'white' : 'gray.900',
    }),
  },
};

const styles = {
  global: (props: any) => ({
    body: {
      bg: props.colorMode === 'dark' ? 'gray.900' : 'gray.50',
      color: props.colorMode === 'dark' ? 'gray.100' : 'gray.800',
    },
    '*::placeholder': {
      color: props.colorMode === 'dark' ? 'gray.400' : 'gray.500',
    },
    '*, *::before, &::after': {
      borderColor: props.colorMode === 'dark' ? 'gray.700' : 'gray.200',
    },
  }),
};

const theme = extendTheme({
  config,
  colors,
  components,
  styles,
  fonts: {
    heading: 'Inter, system-ui, sans-serif',
    body: 'Inter, system-ui, sans-serif',
  },
  shadows: {
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    'dark-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
    'dark-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
  },
});

export default theme;
