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
  created_at?: string;
};

export default function ImageGallery() {
  const { user } = useAuth();
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!user) {
      setImages([]);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchImages = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("images")
        .select(
          "id, user_id, filename, original_path, thumbnail_path, created_at"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching images:", error.message);
        if (isMounted) setLoading(false);
        return;
      }

      if (isMounted) {
        setImages(data ?? []);
        setLoading(false);
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
    };
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
    return (
      <div className='py-8 text-center text-gray-600'>
        No images yet — upload some to see them here.
      </div>
    );
  }

  return (
    <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 py-4'>
      {images.map(img => {
        const { thumbnail_path } = img;
        const { data } = supabase.storage
          .from("thumbnails")
          .getPublicUrl(thumbnail_path);
        const url = data?.publicUrl ?? "";
        return (
          <div
            key={img.id}
            className='overflow-hidden rounded-md bg-white shadow'
          >
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
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
      })}
    </div>
  );
}
