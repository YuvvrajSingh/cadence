import type { NextFunction, Request, Response } from "express";
import { SESSION_COOKIE_NAME } from "../constants/auth";
import { signSessionToken } from "../middleware/auth.middleware";
import { prisma } from "../prisma/client";
import { authService } from "../services/auth.service";
import { sessionCookieMaxAgeMs } from "../utils/authCookie";

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, requestedRole } = req.body as { 
        email?: string; 
        password?: string; 
        requestedRole?: "ADMIN" | "TEACHER" | "STUDENT" | "TIMETABLE_INCHARGE" 
      };
      if (typeof email !== "string" || typeof password !== "string") {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "email and password are required",
        });
      }

      console.log("Login Attempt:", { email, requestedRole });
      const user = await authService.validateCredentials(email, password);
      console.log("User Found:", { role: user.role, isTimetableIncharge: user.isTimetableIncharge });
      
      // Verify permissions for requested role
      const sessionRole = requestedRole || user.role;
      console.log("Session Role Determined:", sessionRole);
      if (sessionRole === "TIMETABLE_INCHARGE") {
        if (user.role !== "ADMIN" && !user.isTimetableIncharge) {
          return res.status(403).json({
            error: "FORBIDDEN",
            message: "You do not have Timetable Incharge permissions",
          });
        }
      } else if (sessionRole === "TEACHER") {
        if (user.role !== "TEACHER") {
          return res.status(403).json({
            error: "FORBIDDEN",
            message: "You do not have Teacher permissions",
          });
        }
      }

      const token = signSessionToken({
        id: user.id,
        role: user.role,
        isTimetableIncharge: user.isTimetableIncharge,
        sessionRole: sessionRole as any,
        teacherId: user.teacherId,
      });

      res.cookie(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: sessionCookieMaxAgeMs(),
        path: "/",
      });

      res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          isTimetableIncharge: user.isTimetableIncharge,
          sessionRole,
          teacherId: user.teacherId,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  logout(_req: Request, res: Response) {
    res.clearCookie(SESSION_COOKIE_NAME, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    res.status(204).send();
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.user!.id;
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          role: true,
          isTimetableIncharge: true,
          teacherId: true,
          isActive: true,
        },
      });
      if (!user || !user.isActive) {
        return res.status(401).json({
          error: "UNAUTHORIZED",
          message: "Session is no longer valid",
        });
      }
      res.status(200).json({ 
        user: {
          ...user,
          sessionRole: req.user!.sessionRole,
          isTimetableIncharge: user.isTimetableIncharge,
        } 
      });
    } catch (error) {
      next(error);
    }
  },
};
