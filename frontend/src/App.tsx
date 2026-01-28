import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';

import { ThemeProvider } from '@/hooks/useTheme';
import { AuthProvider } from '@/contexts/AuthContext';
import { PresenceProvider } from '@/contexts/PresenceContext';
import { NotificationPreferencesProvider } from '@/contexts/NotificationPreferencesContext';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { ToastProvider } from '@/contexts/ToastContext';
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
          <NotificationPreferencesProvider>
            <ToastProvider>
              <NotificationsProvider>
                <RouterProvider router={router} />
              </NotificationsProvider>
            </ToastProvider>
          </NotificationPreferencesProvider>
        </PresenceProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
