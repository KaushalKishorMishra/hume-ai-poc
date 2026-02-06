import { useEffect, useRef, useCallback } from 'react';

interface BeforeUnloadData {
  sessionId: string | null;
  transcript: unknown[];
  durationMs: number;
}

type DataFn = () => BeforeUnloadData | null;

const BACKEND_URL = 'http://localhost:3001';

export function useBeforeUnload(dataFn: DataFn): void {
  const dataFnRef = useRef<DataFn>(dataFn);

  // Keep the data function reference updated
  useEffect(() => {
    dataFnRef.current = dataFn;
  }, [dataFn]);

  const handleBeforeUnload = useCallback(() => {
    const data = dataFnRef.current();
    if (!data || !data.sessionId) return;

    const payload = {
      chatGroupId: data.sessionId,
      transcript: data.transcript,
      status: 'ERROR' as const,
      disconnectReason: 'tab_closed',
      totalQuestions: 0,
      durationMs: data.durationMs,
      errorReason: 'TAB_CLOSED',
    };

    // Use sendBeacon for reliable delivery during page unload
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon(`${BACKEND_URL}/api/session/record`, blob);
    } else {
      // Fallback with keepalive
      fetch(`${BACKEND_URL}/api/session/record`, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {
        // Silent fail - page is closing anyway
      });
    }

    // Also release the session slot
    if (navigator.sendBeacon) {
      const sessionBlob = new Blob([JSON.stringify({ sessionId: data.sessionId })], {
        type: 'application/json',
      });
      navigator.sendBeacon(`${BACKEND_URL}/api/session/end`, sessionBlob);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload); // For iOS Safari

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [handleBeforeUnload]);
}
