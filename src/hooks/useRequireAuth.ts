"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

/** Sends signed-out visitors to the landing page. */
export function useRequireAuth() {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (auth.status === "signedOut") router.replace("/");
  }, [auth.status, router]);
  return auth;
}
