import React, { useState } from 'react';
import { ChakraProvider, Box, Text, Button, VStack, Heading, Container, useColorMode } from '@chakra-ui/react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import theme from './theme';

const HomePage: React.FC = () => {
  const [apiStatus, setApiStatus] = useState('No probado');
  const { colorMode, toggleColorMode } = useColorMode();

  const testAPI = async () => {
    try {
      setApiStatus('Probando...');
      const response = await fetch('http://localhost:3001/api/health');
      const data = await response.json();
      setApiStatus(`✅ API OK: ${JSON.stringify(data)}`);
    } catch (error: any) {
      setApiStatus(`❌ API Error: ${error.message}`);
    }
  };

  return (
    <Container maxW="container.lg" py={8}>
      <VStack spacing={6} align="stretch">
        <Box textAlign="center">
          <Heading size="xl" mb={4} color={colorMode === 'dark' ? 'white' : 'gray.800'}>
            Panel de Control - WhatsApp Bot
          </Heading>
          <Text fontSize="lg" color={colorMode === 'dark' ? 'gray.300' : 'gray.600'}>
            Versión simplificada sin autenticación
          </Text>
        </Box>

        <Box p={6} borderRadius="lg" bg={colorMode === 'dark' ? 'gray.800' : 'white'} shadow="lg">
          <VStack spacing={4}>
            <Text fontSize="md" color={colorMode === 'dark' ? 'gray.300' : 'gray.700'}>
              Estado de la API:
            </Text>
            <Text 
              fontSize="sm" 
              fontFamily="mono" 
              p={3} 
              bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'} 
              borderRadius="md"
              w="full"
              textAlign="center"
            >
              {apiStatus}
            </Text>
            <Button colorScheme="blue" onClick={testAPI}>
              Probar Conexión API
            </Button>
            <Button variant="outline" onClick={toggleColorMode}>
              Cambiar a {colorMode === 'light' ? 'Oscuro' : 'Claro'}
            </Button>
          </VStack>
        </Box>

        <Box p={6} borderRadius="lg" bg={colorMode === 'dark' ? 'gray.800' : 'white'} shadow="lg">
          <VStack spacing={4} align="stretch">
            <Heading size="md" color={colorMode === 'dark' ? 'white' : 'gray.800'}>
              Navegación
            </Heading>
            <VStack spacing={2} align="stretch">
              <Link to="/dashboard">
                <Button w="full" variant="ghost" justifyContent="flex-start">
                  📊 Dashboard
                </Button>
              </Link>
              <Link to="/bot">
                <Button w="full" variant="ghost" justifyContent="flex-start">
                  🤖 Estado del Bot
                </Button>
              </Link>
              <Link to="/usuarios">
                <Button w="full" variant="ghost" justifyContent="flex-start">
                  👥 Usuarios
                </Button>
              </Link>
              <Link to="/grupos">
                <Button w="full" variant="ghost" justifyContent="flex-start">
                  💬 Grupos
                </Button>
              </Link>
            </VStack>
          </VStack>
        </Box>
      </VStack>
    </Container>
  );
};

const SimpleAppNoAuth: React.FC = () => {
  return (
    <ChakraProvider theme={theme}>
      <Router>
        <Routes>
          <Route path="/*" element={<HomePage />} />
        </Routes>
      </Router>
    </ChakraProvider>
  );
};

export default SimpleAppNoAuth;