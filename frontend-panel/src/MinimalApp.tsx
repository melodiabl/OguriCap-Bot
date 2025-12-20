import React from 'react';
import { ChakraProvider, Box, Text, Button } from '@chakra-ui/react';

const MinimalApp: React.FC = () => {
  const [count, setCount] = React.useState(0);

  return (
    <ChakraProvider>
      <Box p={8} bg="gray.900" minH="100vh" color="white">
        <Text fontSize="2xl" mb={4}>
          Aplicación Mínima Funcionando
        </Text>
        
        <Text mb={4}>
          Contador: {count}
        </Text>
        
        <Button 
          onClick={() => setCount(count + 1)} 
          colorScheme="blue" 
          mr={4}
        >
          Incrementar
        </Button>
        
        <Button 
          onClick={() => setCount(0)} 
          colorScheme="red"
        >
          Reset
        </Button>
        
        <Text mt={4} fontSize="sm" color="gray.400">
          Si ves esto y los botones funcionan, React y Chakra UI están OK.
        </Text>
      </Box>
    </ChakraProvider>
  );
};

export default MinimalApp;