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

// Helper function to get the public URL for an image stored in Supabase Storage
export const getSupabaseImageUrl = (imagePath: string | null): string => {
  if (!imagePath) {
    return "https://placehold.co/300x200/cccccc/000000?text=No+Image"
  }

  // If it's already a full URL, return as is
  if (imagePath.startsWith("http")) {
    return imagePath
  }

  // Try to get Supabase client to construct storage URL
  const { client } = tryGetSupabase()
  if (!client) {
    return "https://placehold.co/300x200/cccccc/000000?text=No+Image"
  }

  // Get the public URL from Supabase Storage
  const { data } = client.storage.from("startup-images").getPublicUrl(imagePath)
  return data.publicUrl
}

// Helper function to upload an image to Supabase Storage
export const uploadImageToSupabase = async (file: File, fileName: string) => {
  const { client, error: clientError } = tryGetSupabase()

  if (!client || clientError) {
    throw new Error(clientError || "Supabase client not available")
  }

  const { data, error } = await client.storage.from("startup-images").upload(fileName, file, {
    cacheControl: "3600",
    upsert: false,
  })

  if (error) {
    throw error
  }

  return data.path
}
