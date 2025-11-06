"use client";
import { useDropzone } from "react-dropzone";
import { useState } from "react";
import supabase from "../lib/supabase-config";
import { useAuth } from "../context/AuthContext";
import { UploadCloud } from "lucide-react";
import { processImage } from "@/lib/utils/imageProcessing";
import { uploadToStorage } from "@/lib/api/storage";
import { analyzeImage } from "@/lib/api/analysis";
import { UploadProgress } from "./ui/UploadProgress";

export default function UploadZone() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number>(0);

  const onDrop = async (acceptedFiles: File[]) => {
    if (!user) return alert("Please login first.");
    setUploading(true);
    setProgress(0);

    const totalFiles = acceptedFiles.length;

    for (let idx = 0; idx < acceptedFiles.length; idx++) {
      const file = acceptedFiles[idx];
      const fileBase = Math.floor((idx / totalFiles) * 100);
      const fileSlice = Math.floor(100 / totalFiles);

      if (!["image/jpeg", "image/png"].includes(file.type)) {
        alert("Only JPEG/PNG allowed!");
        continue;
      }

      try {
        // Process the image (thumbnail and base64)
        const {
          thumbnailBlob,
          base64,
          fileName,
          error: processError,
        } = await processImage(file, progress =>
          setProgress(fileBase + Math.floor(fileSlice * progress * 0.3))
        );

        if (processError || !thumbnailBlob || !base64) throw processError;

        // Create preview
        const previewUrl = URL.createObjectURL(thumbnailBlob);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("image:uploaded", {
              detail: {
                previewUrl,
                filename: file.name,
                storedFilename: fileName,
              },
            })
          );
        }

        // Upload to storage and create DB record
        const { error: uploadError, dbData } = await uploadToStorage(
          supabase,
          file,
          thumbnailBlob,
          user.id,
          fileName,
          progress =>
            setProgress(
              fileBase + Math.floor(fileSlice * (0.3 + progress * 0.5))
            )
        );

        if (uploadError || !dbData) throw uploadError;

        // Analyze the image
        const {
          tags,
          description,
          error: analysisError,
        } = await analyzeImage(base64, dbData.id);

        if (!analysisError && typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("image:analyzed", {
              detail: {
                storedFilename: fileName,
                tags,
                description,
              },
            })
          );
        }

        setProgress(Math.min(100, fileBase + fileSlice));
      } catch (error: any) {
        console.error("Upload failed:", error.message || error);
        setProgress(Math.min(100, fileBase + Math.floor(fileSlice * 0.9)));
      }
    }

    // Complete the upload
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
      <UploadProgress progress={progress} uploading={uploading} />
    </div>
  );
}
