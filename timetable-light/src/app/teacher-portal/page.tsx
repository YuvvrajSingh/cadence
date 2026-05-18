"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TeacherPortalSubjectsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/teacher-portal/midterms");
  }, [router]);

  return null;
}
