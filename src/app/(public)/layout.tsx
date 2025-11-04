"use client";

import PublicRoute from "@/components/PublicRoute";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicRoute>{children}</PublicRoute>;
}
