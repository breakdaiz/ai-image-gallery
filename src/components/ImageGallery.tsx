"use client";

import React, { useEffect, useState } from "react";
import supabase from "@/lib/supabase-config";
import { useAuth } from "@/context/AuthContext";

type ImageRecord = {
  id: number;
  user_id: string;
  filename: string;
  original_path: string;
  thumbnail_path: string;
  uploaded_at?: string;
};

export default function ImageGallery() {
  const { user } = useAuth();
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [previews, setPreviews] = useState<
    {
      previewUrl: string;
      filename: string;
      storedFilename?: string;
      createdAt: number;
    }[]
  >([]);
  const [previewsClearedAt, setPreviewsClearedAt] = useState<number | null>(
    null
  );

  // Event listener for preview events from UploadZone — only active while a user is logged in
  useEffect(() => {
    if (!user || typeof window === "undefined") return;

    const onPreview = (e: Event) => {
      // @ts-ignore
      const detail = e?.detail;
      if (detail?.previewUrl) {
        const item = {
          previewUrl: detail.previewUrl,
          filename: detail.filename,
          storedFilename: detail?.storedFilename as string | undefined,
          createdAt: Date.now(),
        };

        // Ignore previews created before the last clear (e.g. from previous sessions)
        if (previewsClearedAt && item.createdAt <= previewsClearedAt) return;

        setPreviews(prev => {
          // append new preview to front so newest is shown first
          return [item, ...prev];
        });

        // NOTE: removed auto-remove timer — previews now persist until the app
        // explicitly removes them (e.g., when a matching DB insert arrives or
        // when the user logs out). This prevents the preview from disappearing
        // after a fixed timeout.
      }
    };

    window.addEventListener("image:uploaded", onPreview as EventListener);

    return () => {
      try {
        window.removeEventListener(
          "image:uploaded",
          onPreview as EventListener
        );
      } catch (err) {}
    };
  }, [user, previewsClearedAt]);

  useEffect(() => {
    let isMounted = true;
    if (!user) return;

    const fetchImages = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("images")
        .select(
          "id, user_id, filename, original_path, thumbnail_path, uploaded_at"
        )
        .eq("user_id", user.id)
        .order("uploaded_at", { ascending: false });

      if (error) {
        console.error("Error fetching images:", error.message);
        if (isMounted) setLoading(false);
        return;
      }

      if (isMounted) {
        const imgs = data ?? [];
        setImages(imgs);
        setLoading(false);

        // thumbnails are loaded via public getPublicUrl; no signed URL prefetch
      }
    };

    fetchImages();

    // Subscribe to real-time inserts to auto-refresh when uploads occur
    const channel = supabase
      .channel("public:images")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "images",
          filter: `user_id=eq.${user.id}`,
        },
        payload => {
          // Prepend new image to the list
          const newImage = payload.new as ImageRecord;
          setImages(prev => [newImage, ...prev]);
          console.log("newImage inserted", newImage);

          // If we have an in-memory preview that matches the stored filename, remove it now
          setPreviews(prev => {
            const toRemove = prev.filter(
              p => p.storedFilename === newImage.filename
            );
            toRemove.forEach(p => {
              try {
                URL.revokeObjectURL(p.previewUrl);
              } catch (err) {}
            });
            return prev.filter(p => p.storedFilename !== newImage.filename);
          });
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      try {
        // unsubscribe and remove channel
        channel.unsubscribe();
        // @ts-ignore
        if (supabase.removeChannel) supabase.removeChannel(channel);
      } catch (err) {
        // ignore
      }
      // (preview event listener is handled by the mount-only effect)
    };
  }, [user]);

  // cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      previews.forEach(p => {
        try {
          URL.revokeObjectURL(p.previewUrl);
        } catch (err) {}
      });
    };
  }, [previews]);

  // ensure previews and images are cleared when the user logs out
  useEffect(() => {
    if (!user) {
      setImages([]);
      setLoading(false);
      setPreviews(prev => {
        prev.forEach(p => {
          try {
            URL.revokeObjectURL(p.previewUrl);
          } catch (err) {}
        });
        return [];
      });
      setPreviewsClearedAt(Date.now());
    }
  }, [user]);

  if (loading) {
    return (
      <div className='flex items-center justify-center py-8'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2' />
          <div className='text-sm text-gray-600'>Loading images...</div>
        </div>
      </div>
    );
  }

  if (!images.length) {
    // If there are no persisted images and no previews, show empty state.
    if (!previews.length) {
      return (
        <div className='py-8 text-center text-gray-600'>
          No images yet — upload some to see them here.
        </div>
      );
    }
    // otherwise fall through and render the previews above the (empty) grid
  }

  // If previews exist, we'll render them above the persisted images in the grid below.

  return (
    <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 py-4'>
      {previews.length > 0 && (
        <div className='col-span-2 sm:col-span-3 md:col-span-4 mb-2'>
          <div className='text-sm text-gray-600 mb-2'>Previews</div>
          <div className='flex flex-wrap gap-3'>
            {previews.map(p => (
              <div
                key={p.previewUrl}
                className='w-40 overflow-hidden rounded-md bg-white shadow'
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.previewUrl}
                  alt={p.filename}
                  className='w-full h-24 object-cover'
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* remove gallery images */}
      {/* {images.map(img => {
        const { thumbnail_path } = img;

        if (!thumbnail_path) return null;

        // If the stored path is already a full URL, use it directly
        if (/^https?:\/\//i.test(thumbnail_path)) {
          const urlDirect = encodeURI(thumbnail_path);
          return (
            <div
              key={img.id}
              className='overflow-hidden rounded-md bg-white shadow'
            >
              
              <img
                src={urlDirect}
                alt={img.filename}
                className='w-full h-40 object-cover'
              />
            </div>
          );
        }

        // If the stored path accidentally includes the bucket name (e.g. "thumbnails/...")
        // strip it so getPublicUrl receives a path relative to the bucket root.
        const normalizedPath = thumbnail_path
          .replace(/^thumbnails\//, "")
          .replace(/^\//, "");

        // Use public URL (works for public buckets)
        const { data } = supabase.storage
          .from("thumbnails")
          .getPublicUrl(normalizedPath);
        const url = data?.publicUrl ?? "";
        const safeUrl = url ? encodeURI(url) : "";
        if (safeUrl) console.debug("ImageGallery: thumbnail url", safeUrl);

        return (
          <div
            key={img.id}
            className='overflow-hidden rounded-md bg-white shadow'
          >
            {safeUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={safeUrl}
                alt={img.filename}
                className='w-full h-40 object-cover'
              />
            ) : (
              <div className='h-40 flex items-center justify-center text-sm text-gray-500'>
                No preview
              </div>
            )}
          </div>
        );
      })} */}
    </div>
  );
}
