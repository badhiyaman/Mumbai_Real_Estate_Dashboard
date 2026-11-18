import { createClient } from "@supabase/supabase-js";

// Read-only client: uses the publishable key, which the database only allows to SELECT.
export function readClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase URL or publishable key missing from .env.local");
  return createClient(url, key, { auth: { persistSession: false } });
}

// Server-only client with write access. Never import this from a "use client" file.
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase URL or secret key missing from .env.local");
  return createClient(url, key, { auth: { persistSession: false } });
}
