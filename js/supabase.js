// Supabase Configuration
const SUPABASE_URL = 'https://qenfmwgfnkbfwzxtpwyf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlbmZtd2dmbmtiZnd6eHRwd3lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTk2NDYsImV4cCI6MjA4OTQ5NTY0Nn0.BnYRee9KuuTy5eUqnKlRIR_8ECNqqod6aD1dKNLIogk';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
