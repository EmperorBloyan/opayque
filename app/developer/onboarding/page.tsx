"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DeveloperOnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/onboarding");
  }, [router]);

  return null;
}
