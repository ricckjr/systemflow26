import React from 'react';
import { RouterProvider } from 'react-router-dom';

import { ThemeProvider } from '@/hooks/useTheme';
import { AuthProvider } from '@/contexts/AuthContext';
import { PresenceProvider } from '@/contexts/PresenceContext';
import { ChatNotificationsProvider } from '@/contexts/ChatNotificationsContext';
import { SystemNotificationsProvider } from '@/contexts/SystemNotificationsContext';
import router from '@/routes';

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PresenceProvider>
          <ChatNotificationsProvider>
            <SystemNotificationsProvider>
              <RouterProvider router={router} />
            </SystemNotificationsProvider>
          </ChatNotificationsProvider>
        </PresenceProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
