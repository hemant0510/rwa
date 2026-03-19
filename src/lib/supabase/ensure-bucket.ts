import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ensures a Supabase Storage bucket exists (private by default).
 * Creates it if missing. Safe to call on every request — list is cached by Supabase SDK.
 */
export async function ensureBucket(
  client: SupabaseClient,
  bucketName: string,
  isPublic = false,
): Promise<void> {
  const { data: buckets, error: listError } = await client.storage.listBuckets();

  if (listError) {
    throw new Error(`Failed to list storage buckets: ${listError.message}`);
  }

  const exists = buckets?.some((b) => b.name === bucketName);
  if (exists) return;

  const { error: createError } = await client.storage.createBucket(bucketName, {
    public: isPublic,
    fileSizeLimit: 10 * 1024 * 1024, // 10 MB hard limit
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  });

  if (createError) {
    throw new Error(`Failed to create storage bucket "${bucketName}": ${createError.message}`);
  }
}
