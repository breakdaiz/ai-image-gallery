"use client";
import { useDropzone } from "react-dropzone";
import imageCompression from "browser-image-compression";
import { useState } from "react";
import supabase from "../lib/supabase-config";
import { useAuth } from "../context/AuthContext";
import { UploadCloud } from "lucide-react";

import React from "react";

export default function UploadZone() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number>(0);

  const onDrop = async (acceptedFiles: File[]) => {
    if (!user) return alert("Please login first.");
    setUploading(true);

    // Track overall progress across all files
    const totalFiles = acceptedFiles.length;
    setProgress(0);

    for (let idx = 0; idx < acceptedFiles.length; idx++) {
      const file = acceptedFiles[idx];
      const fileBase = Math.floor((idx / totalFiles) * 100);
      // We'll update progress relative to this file's slice (approximate)
      const fileSlice = Math.floor(100 / totalFiles);
      if (!["image/jpeg", "image/png"].includes(file.type)) {
        alert("Only JPEG/PNG allowed!");
        continue;
      }

      try {
        //  1. Generate thumbnail
        const thumbnailBlob = await imageCompression(file, {
          maxWidthOrHeight: 300,
          useWebWorker: true,
        });
        // Create a local preview URL for immediate preview in the gallery
        try {
          const previewUrl = URL.createObjectURL(thumbnailBlob);
          // Dispatch a global event so other components (ImageGallery) can show the preview
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("image:uploaded", {
                detail: { previewUrl, filename: file.name },
              })
            );
          }
        } catch (err) {
          // ignore preview creation errors
        }
        // update progress: thumbnail generated (~10% of this file)
        setProgress(fileBase + Math.floor(fileSlice * 0.1));

        //  2. Prepare paths
        const fileName = `${Date.now()}-${file.name}`;
        const userId = user.id;
        const originalPath = `/${userId}/${fileName}`;
        const thumbnailPath = `/${userId}/${fileName}`;

        //  3. Upload original file
        const { error: origErr } = await supabase.storage
          .from("originals")
          .upload(originalPath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (origErr) throw origErr;
        // update progress: original uploaded (~60% of this file)
        setProgress(fileBase + Math.floor(fileSlice * 0.6));

        //   Upload thumbnail
        const { error: thumbErr } = await supabase.storage
          .from("thumbnails")
          .upload(thumbnailPath, thumbnailBlob);

        if (thumbErr) throw thumbErr;
        // update progress: thumbnail uploaded (~80% of this file)
        setProgress(fileBase + Math.floor(fileSlice * 0.8));

        //  Insert record in DB
        const { error: dbErr } = await supabase.from("images").insert([
          {
            user_id: userId,
            filename: fileName,
            original_path: originalPath,
            thumbnail_path: thumbnailPath,
          },
        ]);

        if (dbErr) throw dbErr;

        // update progress: file complete
        setProgress(Math.min(100, fileBase + fileSlice));

        console.log("✅ Uploaded:", fileName);
      } catch (error: any) {
        console.error("Upload failed:", error.message || error);
        // indicate failure for this file by moving progress a bit forward
        setProgress(Math.min(100, fileBase + Math.floor(fileSlice * 0.9)));
      }
    }

    // ensure progress shows complete briefly
    setProgress(100);
    setTimeout(() => {
      setUploading(false);
      setProgress(0);
    }, 700);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition ${
        isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
      }`}
    >
      <input {...getInputProps()} />
      <UploadCloud size={40} className='text-gray-400 mb-4' />
      <p className='text-gray-700 text-center'>
        {isDragActive
          ? "Drop the images here..."
          : "Drag & drop or click to upload"}
      </p>

      {uploading && (
        <div className='mt-4 w-full max-w-sm'>
          <div className='text-center text-sm text-gray-600'>
            Uploading... {progress}%
          </div>
          <div className='w-full bg-gray-200 rounded-full h-2 mt-2'>
            <div
              className='bg-blue-600 h-2 rounded-full'
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
