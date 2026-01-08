import React from 'react';
import { RouterProvider } from 'react-router-dom';

import { ThemeProvider } from './hooks/useTheme';
import { AuthProvider } from './src/contexts/AuthContext';
import router from './src/routes/index.tsx';

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
