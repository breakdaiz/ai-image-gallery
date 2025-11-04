"use client";

import PrivateRoute from "@/components/PrivateRoute";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PrivateRoute>
      <main className='min-h-screen bg-gray-50'>{children}</main>
    </PrivateRoute>
  );
}
