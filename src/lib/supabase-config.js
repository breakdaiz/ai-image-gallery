import { createClient } from "@supabase/supabase-js";

// Prefer NEXT_PUBLIC_* env vars (available to client). Fall back to old names
// if the project used different env var names in the past.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PROJ_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_API_KEY ||
  "";

if (!supabaseUrl || !supabaseKey) {
  // Provide a developer-friendly error that explains what's missing and how to fix it.
  throw new Error(
    "Missing Supabase environment variables. Please set these in your .env.local:\n" +
      "  NEXT_PUBLIC_SUPABASE_URL\n" +
      "  NEXT_PUBLIC_SUPABASE_ANON_KEY\n" +
      "Or use legacy names:\n" +
      "  SUPABASE_PROJ_URL\n" +
      "  SUPABASE_API_KEY"
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
