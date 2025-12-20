import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Button, Heading, Text, VStack } from '@chakra-ui/react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error capturado por ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          minH="100vh"
          bg="gray.900"
          p={4}
        >
          <VStack spacing={6} maxW="md" textAlign="center">
            <Heading color="red.400" size="xl">
              ¡Ups! Algo salió mal
            </Heading>
            <Text color="gray.400">
              {this.state.error?.message || 'Ha ocurrido un error inesperado'}
            </Text>
            <Button colorScheme="blue" onClick={this.handleReset}>
              Volver al inicio
            </Button>
          </VStack>
        </Box>
      );
    }

    return this.props.children;
  }
}
