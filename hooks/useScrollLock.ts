import { useEffect } from 'react';

export function useScrollLock(lock: boolean) {
  useEffect(() => {
    const original = document.body.style.overflow;
    if (lock) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = original || '';
    }
    return () => {
      document.body.style.overflow = original || '';
    };
  }, [lock]);
}

