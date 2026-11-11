import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppConfig } from '../config.js';

export interface SupabaseIntegration {
  configured: boolean;
  publicClient?: SupabaseClient;
  /** Optional and reserved for future explicitly privileged backend jobs. */
  serviceClient?: SupabaseClient;
  requestClient(accessToken: string): SupabaseClient | undefined;
  checkReadiness(): Promise<boolean>;
  resolveTenant(accessToken: string): Promise<{ authUserId: string; isyenId: string } | null>;
}

const authOptions = {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
};

export function createSupabaseIntegration(config: AppConfig): SupabaseIntegration {
  const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
  const publicClient = configured
    ? createClient(config.supabaseUrl as string, config.supabaseAnonKey as string, authOptions)
    : undefined;
  const serviceClient = config.supabaseUrl && config.supabaseServiceRoleKey
    ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey, authOptions)
    : undefined;

  function requestClient(accessToken: string): SupabaseClient | undefined {
    if (!publicClient || !config.supabaseUrl || !config.supabaseAnonKey || !accessToken) return undefined;
    return createClient(config.supabaseUrl, config.supabaseAnonKey, {
      ...authOptions,
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
  }

  return {
    configured,
    publicClient,
    serviceClient,
    requestClient,
    async checkReadiness() {
      if (!config.supabaseUrl || !config.supabaseAnonKey) return false;
      try {
        const response = await fetch(`${config.supabaseUrl}/auth/v1/settings`, {
          headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}` },
          signal: AbortSignal.timeout(4_000),
        });
        return response.ok;
      } catch {
        return false;
      }
    },
    async resolveTenant(accessToken: string) {
      if (!publicClient) return null;
      const { data: userData, error: userError } = await publicClient.auth.getUser(accessToken);
      if (userError || !userData.user) return null;

      // The user's JWT and the user_profiles self-read RLS policy are sufficient;
      // tenant resolution never needs a service-role query or an RLS bypass.
      const userClient = requestClient(accessToken);
      if (!userClient) return null;
      const { data: profile, error: profileError } = await userClient
        .from('user_profiles')
        .select('isyen_id,profile_status')
        .eq('auth_user_id', userData.user.id)
        .in('profile_status', ['active', 'incomplete'])
        .maybeSingle();
      if (profileError || !profile?.isyen_id) return null;
      return { authUserId: userData.user.id, isyenId: profile.isyen_id as string };
    },
  };
}
