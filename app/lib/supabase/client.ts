import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client
 * Uses cookie-based session storage for SSR compatibility
 */

// Handle both client-side (import.meta.env) and server-side (process.env) environments
const getEnvVar = (key: string, defaultValue: string = '') => {
  // Try import.meta.env first (client-side or build-time)
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key] as string;
  }
  // Fall back to process.env (server-side runtime)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  return defaultValue;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0');

// Create browser client with automatic cookie handling
export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);

// Database types
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          created_at?: string;
        };
      };
      chats: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          url_id: string | null;
          created_at: string;
          updated_at: string;
          metadata: any | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          url_id?: string | null;
          created_at?: string;
          updated_at?: string;
          metadata?: any | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string | null;
          url_id?: string | null;
          created_at?: string;
          updated_at?: string;
          metadata?: any | null;
        };
      };
      messages: {
        Row: {
          id: string;
          chat_id: string;
          role: string;
          content: any;
          sequence: number;
          annotations: any | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          chat_id: string;
          role: string;
          content: any;
          sequence?: number;
          annotations?: any | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          chat_id?: string;
          role?: string;
          content?: any;
          sequence?: number;
          annotations?: any | null;
          created_at?: string;
        };
      };
      snapshots: {
        Row: {
          id: string;
          chat_id: string;
          message_id: string | null;
          files_json: any | null;
          summary: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          chat_id: string;
          message_id?: string | null;
          files_json?: any | null;
          summary?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          chat_id?: string;
          message_id?: string | null;
          files_json?: any | null;
          summary?: string | null;
          created_at?: string;
        };
      };
      final_versions: {
        Row: {
          id: string;
          user_id: string;
          snapshot_id: string;
          chat_id: string;
          selected_at: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          snapshot_id: string;
          chat_id: string;
          selected_at?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          snapshot_id?: string;
          chat_id?: string;
          selected_at?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      workflow_states: {
        Row: {
          id: string;
          room_id: string;
          current_node: string;
          host_user_id: string;
          visited_nodes: string[];
          metadata: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          current_node?: string;
          host_user_id: string;
          visited_nodes?: string[];
          metadata?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          current_node?: string;
          host_user_id?: string;
          visited_nodes?: string[];
          metadata?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}
