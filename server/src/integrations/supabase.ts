import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppConfig } from '../config.js';

export interface SupabaseIntegration {
  configured: boolean;
  publicClient?: SupabaseClient;
  serviceClient?: SupabaseClient;
  requestClient(accessToken: string): SupabaseClient | undefined;
  resolveTenant(accessToken: string): Promise<{ authUserId: string; isyenId: string } | null>;
}

export function createSupabaseIntegration(config: AppConfig): SupabaseIntegration {
  const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
  const publicClient = configured
    ? createClient(config.supabaseUrl as string, config.supabaseAnonKey as string, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      })
    : undefined;
  const serviceClient = config.supabaseUrl && config.supabaseServiceRoleKey
    ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      })
    : undefined;

  return {
    configured,
    publicClient,
    serviceClient,
    requestClient(accessToken: string) {
      if (!publicClient) return undefined;
      return createClient(config.supabaseUrl as string, config.supabaseAnonKey as string, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      });
    },
    async resolveTenant(accessToken: string) {
      if (!serviceClient) return null;
      const { data: userData, error: userError } = await serviceClient.auth.getUser(accessToken);
      if (userError || !userData.user) return null;
      const { data: profile, error: profileError } = await serviceClient
        .from('user_profiles')
        .select('isyen_id')
        .eq('auth_user_id', userData.user.id)
        .neq('profile_status', 'deleted')
        .maybeSingle();
      if (profileError || !profile?.isyen_id) return null;
      return { authUserId: userData.user.id, isyenId: profile.isyen_id as string };
    },
  };
}
