import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';

import { ThemeProvider } from '@/hooks/useTheme';
import { AuthProvider } from '@/contexts/AuthContext';
import { PresenceProvider } from '@/contexts/PresenceContext';
import { ChatNotificationsProvider } from '@/contexts/ChatNotificationsContext';
import { SystemNotificationsProvider } from '@/contexts/SystemNotificationsContext';
import { primeNotificationAudio } from '@/utils/notificationSound';
import router from '@/routes';

const App: React.FC = () => {
  useEffect(() => {
    const prime = () => {
      void primeNotificationAudio()
      window.removeEventListener('pointerdown', prime)
      window.removeEventListener('keydown', prime)
    }
    window.addEventListener('pointerdown', prime, { passive: true } as any)
    window.addEventListener('keydown', prime)
    return () => {
      window.removeEventListener('pointerdown', prime as any)
      window.removeEventListener('keydown', prime as any)
    }
  }, [])

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
