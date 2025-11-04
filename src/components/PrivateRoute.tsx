"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

interface PrivateRouteProps {
  children: React.ReactNode;
}

export default function PrivateRoute({ children }: PrivateRouteProps) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Don't redirect while loading to prevent flash of content
    if (!loading && !session) {
      // Store the attempted URL to redirect back after login
      if (pathname && pathname !== "/") {
        // You could store this in localStorage or a cookie if needed
        router.replace("/");
      } else {
        router.replace("/");
      }
    }
  }, [session, loading, router, pathname]);

  // Show nothing while loading
  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900'></div>
      </div>
    );
  }

  // Only render children if we have a session
  return session ? <>{children}</> : null;
}
