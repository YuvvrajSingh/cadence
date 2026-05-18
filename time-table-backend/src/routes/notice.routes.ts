import { Router } from "express";
import { noticeController } from "../controllers/notice.controller";
import { authenticate, requireAdmin, requireAdminOrTeacher } from "../middleware/auth.middleware";
import { upload } from "../middleware/upload.middleware";

const router = Router();

router.post("/upload", authenticate, upload.array("files", 5), noticeController.uploadFiles);
router.post("/", authenticate, noticeController.create);
router.get("/", noticeController.list);
router.delete("/:id", requireAdminOrTeacher, noticeController.remove);
router.post("/:id/report", authenticate, noticeController.report);
router.post("/:id/restore", requireAdminOrTeacher, noticeController.restore);

export default router;
