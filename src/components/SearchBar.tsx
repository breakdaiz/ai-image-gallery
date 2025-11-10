"use client";

import React, { useState, useCallback } from "react";

export default function SearchBar({ userId }: { userId?: string }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout>();

  // Debounced search function to avoid too many requests
  const debouncedSearch = useCallback(
    (searchTerm: string) => {
      if (searchTimeout) clearTimeout(searchTimeout);
      const timeout = setTimeout(async () => {
        if (!searchTerm.trim()) {
          // Clear results if search is empty
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("image:search:results", {
                detail: { images: [] },
              })
            );
          }
          return;
        }
        setError(null);
        setLoading(true);

        try {
          const res = await fetch("/api/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ q: searchTerm.trim(), userId }),
          });
          const json = await res.json();
          if (!json?.success) {
            setError(json?.error || "Unknown error");
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("image:search:results", {
                  detail: { images: [] },
                })
              );
            }
          } else {
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("image:search:results", {
                  detail: { images: json.images ?? [] },
                })
              );
            }
          }
        } catch (err: any) {
          setError(String(err));
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("image:search:results", {
                detail: { images: [] },
              })
            );
          }
        } finally {
          setLoading(false);
        }
      }, 300); // Wait 300ms after typing stops before searching

      setSearchTimeout(timeout);
    },
    [userId]
  );

  // Clean up timeout on unmount
  React.useEffect(() => {
    return () => {
      if (searchTimeout) clearTimeout(searchTimeout);
    };
  }, [searchTimeout]);

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQ(value);
    debouncedSearch(value);
  };

  // Handle form submission (for when user presses enter)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    debouncedSearch(q);
  };

  return (
    <form onSubmit={handleSubmit} className='mb-4 flex gap-2 items-center'>
      <input
        value={q}
        onChange={handleChange}
        placeholder='Search images (tags, description, colors)'
        className='border rounded px-3 py-2 flex-1'
      />
      {loading && <div className='text-sm text-gray-600'>Searching...</div>}
      {error && <div className='text-red-600 text-sm ml-2'>{error}</div>}
    </form>
  );
}
