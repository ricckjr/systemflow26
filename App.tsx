
import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from './hooks/useTheme';
import { AuthProvider } from './context/AuthContext';
import { router } from './router';

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
