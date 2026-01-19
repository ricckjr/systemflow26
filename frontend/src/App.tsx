import React from 'react';
import { RouterProvider } from 'react-router-dom';

import { ThemeProvider } from '@/hooks/useTheme';
import { AuthProvider } from '@/contexts/AuthContext';
import { PresenceProvider } from '@/contexts/PresenceContext';
import { ChatNotificationsProvider } from '@/contexts/ChatNotificationsContext';
import router from '@/routes';

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PresenceProvider>
          <ChatNotificationsProvider>
            <RouterProvider router={router} />
          </ChatNotificationsProvider>
        </PresenceProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
