import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

type UseTvModeOptions = {
  paramName?: string;
};

type EnterTvModeOptions = {
  element?: HTMLElement | null;
};

export function useTvMode(options: UseTvModeOptions = {}) {
  const { paramName = 'tv' } = options;
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [isRequestingFullscreen, setIsRequestingFullscreen] = useState(false);
  const isTvMode = useMemo(() => searchParams.get(paramName) === '1', [paramName, searchParams]);

  const wasInFullscreenRef = useRef(false);

  const setTvQueryParam = useCallback(
    (next: boolean) => {
      const nextParams = new URLSearchParams(searchParams);
      if (next) nextParams.set(paramName, '1');
      else nextParams.delete(paramName);
      navigate({ pathname: location.pathname, search: nextParams.toString() ? `?${nextParams.toString()}` : '' }, { replace: true });
    },
    [location.pathname, navigate, paramName, searchParams]
  );

  const enterTvMode = useCallback(
    async ({ element }: EnterTvModeOptions = {}) => {
      setTvQueryParam(true);

      if (!element) return;
      if (!document.fullscreenEnabled) return;

      try {
        setIsRequestingFullscreen(true);
        await element.requestFullscreen();
        wasInFullscreenRef.current = true;
      } catch {
      } finally {
        setIsRequestingFullscreen(false);
      }
    },
    [setTvQueryParam]
  );

  const exitTvMode = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
    } finally {
      wasInFullscreenRef.current = false;
      setTvQueryParam(false);
    }
  }, [setTvQueryParam]);

  const toggleTvMode = useCallback(
    async ({ element }: EnterTvModeOptions = {}) => {
      if (isTvMode) {
        await exitTvMode();
      } else {
        await enterTvMode({ element });
      }
    },
    [enterTvMode, exitTvMode, isTvMode]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (!isTvMode) return;
      e.preventDefault();
      void exitTvMode();
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true } as any);
  }, [exitTvMode, isTvMode]);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!isTvMode) return;
      const isNowFullscreen = Boolean(document.fullscreenElement);
      if (!isNowFullscreen && wasInFullscreenRef.current) {
        wasInFullscreenRef.current = false;
        setTvQueryParam(false);
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [isTvMode, setTvQueryParam]);

  return {
    isTvMode,
    isRequestingFullscreen,
    enterTvMode,
    exitTvMode,
    toggleTvMode,
  };
}

