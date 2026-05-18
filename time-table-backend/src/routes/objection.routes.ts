import { NextFunction, Request, Response, Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  createObjection,
  getMyObjections,
  getAllObjections,
  reviewObjection,
} from "../controllers/objection.controller";

const router = Router();

// ── Role guard helpers ──────────────────────────────────────────────────────
const requireStudent = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role === "STUDENT") return next();
  return res.status(403).json({ error: "FORBIDDEN", message: "Student access required." });
};

const requireTeacherOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  const role = req.user?.role;
  if (role === "TEACHER" || role === "ADMIN") return next();
  return res.status(403).json({ error: "FORBIDDEN", message: "Teacher or admin access required." });
};

// ── All routes require authentication ───────────────────────────────────────
router.use(authenticate);

// ── Student routes ───────────────────────────────────────────────────────────
// POST  /api/objections          – Submit a new objection
router.post("/", requireStudent, createObjection);

// GET   /api/objections/my       – Get my objections (with ?exam_id= & ?roll_number=)
router.get("/my", requireStudent, getMyObjections);

// ── Teacher / Admin routes ───────────────────────────────────────────────────
// GET   /api/objections          – List all objections (optional ?exam_id= & ?status=)
router.get("/", requireTeacherOrAdmin, getAllObjections);

// PATCH /api/objections/:id      – Resolve or dismiss an objection
router.patch("/:id", requireTeacherOrAdmin, reviewObjection);

export default router;
