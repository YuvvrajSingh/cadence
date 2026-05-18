import { Router } from "express";
import { z } from "zod";
import { authenticate, requireAdmin, requireAdminOrTeacherSelf, requireTimetableRole } from "../middleware/auth.middleware";
import { idParamSchema, objectIdSchema } from "../schemas/common";

export {
  Router,
  z,
  authenticate,
  requireAdmin,
  requireTimetableRole,
  requireAdminOrTeacherSelf,
  idParamSchema,
  objectIdSchema,
};
