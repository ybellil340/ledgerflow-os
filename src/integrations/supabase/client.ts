import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://kffoobvffjmdblugcddl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmZm9vYnZmZmptZGJsdWdjZGRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Nzg1NzYsImV4cCI6MjA4OTM1NDU3Nn0.xvWFSN0lLzh0q7iq049Y_4lCSJtDzBUvkJl1oNnX5wk";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
