// Stub module for @supabase/realtime-js to prevent Edge Runtime errors
// This is used during SSR/build when realtime subscriptions aren't needed

export interface RealtimeClientOptions {
  headers?: Record<string, string>;
  accessToken?: () => Promise<string | null>;
  params?: Record<string, string>;
  [key: string]: unknown;
}

export class RealtimeClient {
  constructor(_url: string, _options?: RealtimeClientOptions) {
    // Stub implementation - no-op
    // Accepts the same parameters as the real RealtimeClient but does nothing
  }
  
  connect() {
    return Promise.resolve();
  }
  
  disconnect() {
    return Promise.resolve();
  }
  
  setAuth(_token: string | null) {
    // Stub implementation - no-op
    // Called by Supabase client when auth state changes
    return this;
  }
  
  channel(_topic: string, _params?: Record<string, string>) {
    return {
      subscribe: () => ({ unsubscribe: () => {} }),
      on: () => this,
      off: () => this,
      send: () => Promise.resolve(),
    };
  }
  
  removeChannel(_channel: unknown) {
    return this;
  }
  
  removeAllChannels() {
    return this;
  }
}

export type RealtimeChannel = ReturnType<RealtimeClient['channel']>;
export type RealtimeChannelOptions = Record<string, unknown>;

export default RealtimeClient;

