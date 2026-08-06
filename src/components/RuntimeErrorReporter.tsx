import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';

function normalizeReason(reason: unknown): { message: string; stack: string | null } {
  if (reason instanceof Error) {
    return { message: reason.message || reason.name, stack: reason.stack || null };
  }
  if (typeof reason === 'string') return { message: reason, stack: null };
  try {
    return { message: JSON.stringify(reason), stack: null };
  } catch {
    return { message: 'Unhandled client error', stack: null };
  }
}

export default function RuntimeErrorReporter() {
  const { project } = useProject();
  const recent = useRef(new Map<string, number>());

  useEffect(() => {
    if (!supabase || !project) return;

    const report = async (message: string, stack: string | null) => {
      const normalizedMessage = message.trim().slice(0, 2000);
      if (!normalizedMessage) return;

      const fingerprint = `${normalizedMessage}|${window.location.pathname}`;
      const now = Date.now();
      const lastReported = recent.current.get(fingerprint) || 0;
      if (now - lastReported < 60_000) return;
      recent.current.set(fingerprint, now);

      try {
        await supabase.rpc('report_client_error', {
          p_project_id: project.id,
          p_message: normalizedMessage,
          p_stack: stack?.slice(0, 10_000) || null,
          p_path: `${window.location.pathname}${window.location.search}`.slice(0, 1000),
          p_user_agent: navigator.userAgent.slice(0, 1000),
        });
      } catch {
        // Error reporting must never create another user-facing failure.
      }
    };

    const onError = (event: ErrorEvent) => {
      void report(event.message || 'Window error', event.error instanceof Error ? event.error.stack || null : null);
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const normalized = normalizeReason(event.reason);
      void report(normalized.message, normalized.stack);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, [project]);

  return null;
}
