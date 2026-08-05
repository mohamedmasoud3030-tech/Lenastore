import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
// Allow overriding via localStorage for runtime testing in AI Studio
const getSupabaseConfig = () => {
  // @ts-ignore
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  // @ts-ignore
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (envUrl && envKey) {
    return { url: envUrl, key: envKey };
  }
  
  // Check local storage if env vars are missing
  try {
    const localUrl = localStorage.getItem('supabase_url');
    const localKey = localStorage.getItem('supabase_key');
    if (localUrl && localKey) {
      return { url: localUrl, key: localKey };
    }
  } catch (e) {
    // Ignore
  }
  
  return null;
};

const config = getSupabaseConfig();

export const supabase = config ? createClient(config.url, config.key) : null;

export const saveSupabaseConfig = (url: string, key: string) => {
  localStorage.setItem('supabase_url', url);
  localStorage.setItem('supabase_key', key);
  window.location.reload();
};

export const clearSupabaseConfig = () => {
  localStorage.removeItem('supabase_url');
  localStorage.removeItem('supabase_key');
  window.location.reload();
};
