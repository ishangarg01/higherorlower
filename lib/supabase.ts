import { createClient } from "@supabase/supabase-js"

export interface Startup {
  id: number
  name: string
  description: string
  valuation: number
  image_url: string | null
  created_at: string
  updated_at: string
}

// Try to get Supabase client, but don't throw if environment variables are missing
export const tryGetSupabase = () => {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return { client: null, error: "Supabase URL and Anon Key are required. Check your environment variables." }
    }

    const client = createClient(supabaseUrl, supabaseAnonKey)
    return { client, error: null }
  } catch (err) {
    return { client: null, error: err instanceof Error ? err.message : "Failed to initialize Supabase client" }
  }
}
