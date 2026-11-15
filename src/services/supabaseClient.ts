import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Retrieve public environment variables for Supabase (Vite client-side)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

function isValidHttpUrl(stringUrl: string): boolean {
  if (!stringUrl || typeof stringUrl !== 'string') return false;
  try {
    const url = new URL(stringUrl);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Check if client-side Supabase credentials are provided and valid
 */
export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  isValidHttpUrl(supabaseUrl) &&
  !supabaseUrl.includes('your-project-id') &&
  !supabaseAnonKey.includes('your-anon-publishable-key')
);

/**
 * Reusable Supabase Client instance (Singleton)
 * Uses only publishable Anon Key (Safe for frontend browser code)
 */
export const supabase: SupabaseClient | null = (() => {
  if (!isSupabaseConfigured) return null;
  try {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  } catch (err) {
    console.warn('Supabase client initialization skipped:', err);
    return null;
  }
})();

export interface SupabaseConnectionStatus {
  isConfigured: boolean;
  isConnected: boolean;
  url: string;
  errorMessage?: string;
  latencyMs?: number;
}

/**
 * Tests the live connection to the Supabase project.
 * Does NOT create or alter tables. Strictly probes connection health.
 */
export async function testSupabaseConnection(): Promise<SupabaseConnectionStatus> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      isConfigured: false,
      isConnected: false,
      url: supabaseUrl || 'Not configured in VITE_SUPABASE_URL',
      errorMessage: 'VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables are missing or default placeholders.',
    };
  }

  const startTime = performance.now();
  try {
    // Probe Supabase Auth health without side-effects
    const { error } = await supabase.auth.getSession();
    const latencyMs = Math.round(performance.now() - startTime);

    if (error) {
      return {
        isConfigured: true,
        isConnected: false,
        url: supabaseUrl,
        errorMessage: error.message,
        latencyMs,
      };
    }

    return {
      isConfigured: true,
      isConnected: true,
      url: supabaseUrl,
      latencyMs,
    };
  } catch (err: any) {
    return {
      isConfigured: true,
      isConnected: false,
      url: supabaseUrl,
      errorMessage: err?.message || 'Network error connecting to Supabase endpoint',
    };
  }
}
