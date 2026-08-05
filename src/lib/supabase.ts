import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://bsrshhgjtnrvsckeqsmg.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_hppcnZqxMfjdhE672QVYIg_E7O0lsck';

const getSupabaseConfig = () => {
  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (envUrl && envKey) {
    return { url: envUrl, key: envKey };
  }

  return {
    url: DEFAULT_SUPABASE_URL,
    key: DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  };
};

const config = getSupabaseConfig();

export const supabase = createClient(config.url, config.key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const saveSupabaseConfig = (_url: string, _key: string) => {
  throw new Error('Supabase is centrally configured for this deployment.');
};

export const clearSupabaseConfig = () => {
  throw new Error('Supabase is centrally configured for this deployment.');
};
