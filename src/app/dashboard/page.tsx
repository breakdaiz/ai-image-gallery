"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const { signOut } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut();
      // Optionally, you can redirect the user to the homepage or login page after logout
      router.push("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className='container mx-auto px-4 py-8'>
      <div className='max-w-4xl mx-auto'>
        <h1 className='text-4xl font-bold mb-6'>AI Image Gallery</h1>
        <p className='text-lg text-gray-600 mb-8'>
          Welcome to your personal AI-generated image gallery
        </p>
        <div className='flex gap-4'>
          <Button>Get Started</Button>
          <Button variant='outline' onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}
