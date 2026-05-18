import type { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
        isTimetableIncharge: boolean;
        sessionRole: "ADMIN" | "TEACHER" | "STUDENT" | "TIMETABLE_INCHARGE";
        teacherId: string | null;
      };
    }
  }
}

export {};
