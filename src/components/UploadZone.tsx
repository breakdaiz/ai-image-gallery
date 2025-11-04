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

    for (const file of acceptedFiles) {
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

        //  2. Prepare paths
        const fileName = `${Date.now()}-${file.name}`;
        const userId = user.id;
        const originalPath = `originals/${userId}/${fileName}`;
        const thumbnailPath = `thumbnails/${userId}/${fileName}`;

        //  3. Upload original file
        const { error: origErr } = await supabase.storage
          .from("originals")
          .upload(originalPath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (origErr) throw origErr;

        //   Upload thumbnail
        const { error: thumbErr } = await supabase.storage
          .from("thumbnails")
          .upload(thumbnailPath, thumbnailBlob);

        if (thumbErr) throw thumbErr;

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

        console.log("✅ Uploaded:", fileName);
      } catch (error: any) {
        console.error("Upload failed:", error.message);
      }
    }

    setUploading(false);
    setProgress(0);
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
