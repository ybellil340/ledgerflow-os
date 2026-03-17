import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://szpprhwjywehidmgicsz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6cHByaHdqeXdlaGlkbWdpY3N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MTUzNzYsImV4cCI6MjA4OTI5MTM3Nn0.MysY8PkX_YgFlZqJ8QhH13AocYprR1fhOiMnUZXR3to";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
