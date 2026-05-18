"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TeacherAttendancePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/teacher-portal/midterms");
  }, [router]);

  return null;
}
