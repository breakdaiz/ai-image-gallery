import { SupabaseClient } from "@supabase/supabase-js";

export type UploadResult = {
  error?: Error;
  original_path?: string;
  thumbnail_path?: string;
  dbData?: any;
};

export async function uploadToStorage(
  supabase: SupabaseClient,
  file: File,
  thumbnailBlob: Blob,
  userId: string,
  fileName: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  const originalPath = `/${userId}/${fileName}`;
  const thumbnailPath = `/${userId}/${fileName}`;

  try {
    // Upload original file
    const { error: origErr } = await supabase.storage
      .from("originals")
      .upload(originalPath, file, {
        upsert: false,
        cacheControl: "no-cache, no-store, must-revalidate",
      });

    if (origErr) throw origErr;
    onProgress?.(60);

    // Upload thumbnail
    const { error: thumbErr } = await supabase.storage
      .from("thumbnails")
      .upload(thumbnailPath, thumbnailBlob, {
        upsert: false,
        cacheControl: "no-cache, no-store, must-revalidate",
      });

    if (thumbErr) throw thumbErr;
    onProgress?.(80);

    // Insert database record
    const { error: dbErr, data: dbData } = await supabase
      .from("images")
      .insert([
        {
          user_id: userId,
          filename: fileName,
          original_path: originalPath,
          thumbnail_path: thumbnailPath,
        },
      ])
      .select()
      .single();

    if (dbErr) throw dbErr;
    onProgress?.(90);

    return {
      original_path: originalPath,
      thumbnail_path: thumbnailPath,
      dbData,
    };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }
}
