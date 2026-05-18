import { NextFunction, Request, Response, Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { 
  gradeaiProxyController, 
  enforceStreamLimits, 
  injectTeacherIdentity 
} from "../controllers/gradeai-proxy.controller";

const router = Router();

const requireTeacherOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  const role = req.user?.role;
  if (role === "TEACHER" || role === "ADMIN") {
    return next();
  }
  return res.status(403).json({ error: "FORBIDDEN", message: "Teacher or admin access required" });
};

const requireAnyAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.user) {
    return next();
  }
  return res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required" });
};

// ── Public Routes (Do not require auth) ──────────────────────────
router.get("/health", gradeaiProxyController.healthCheck);
router.get("/options", gradeaiProxyController.getOptions);
router.get("/diagrams{/*tail}", gradeaiProxyController.createProxy("/diagrams/"));
router.get("/uploads{/*tail}", gradeaiProxyController.createProxy("/api/uploads/"));

// Midterm upload route; accessible to students (via portal) and teachers (via assembly line).
router.post(
  "/public/upload",
  authenticate,
  requireAnyAuth,
  injectTeacherIdentity,
  enforceStreamLimits,
  gradeaiProxyController.createProxy("/api/student/upload", 300000)
);

// ── Protected Routes ─────────────────────────────────────────────
router.use(authenticate);
router.use(injectTeacherIdentity);

// Express 5 / path-to-regexp v8 uses {/*tail} for optional catch-all segments.

// For teacher routes (which includes /add-question and /process-pending)
// We apply 50MB limit and 5-minute timeout.
router.all(
  "/teacher{/*tail}",
  enforceStreamLimits,
  gradeaiProxyController.createProxy("/api/teacher/", 300000)
);

// For student fetch routes (results, etc)
router.all(
  "/student{/*tail}",
  gradeaiProxyController.createProxy("/api/student/", 30000) // standard 30s timeout
);

export default router;
