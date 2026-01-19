import React from 'react';
import { RouterProvider } from 'react-router-dom';

import { ThemeProvider } from '@/hooks/useTheme';
import { AuthProvider } from '@/contexts/AuthContext';
import { PresenceProvider } from '@/contexts/PresenceContext';
import router from '@/routes';

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PresenceProvider>
          <RouterProvider router={router} />
        </PresenceProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
