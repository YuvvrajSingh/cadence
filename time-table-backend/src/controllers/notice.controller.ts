import type { NextFunction, Request, Response } from "express";
import { noticeService } from "../services/notice.service";
import { NoticeTarget } from "@prisma/client";
import { prisma } from "../prisma/client";

export const noticeController = {
  async uploadFiles(req: Request, res: Response, next: NextFunction) {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const attachments = files.map((file) => ({
        url: `/uploads/notices/${file.filename}`,
        name: file.originalname,
        type: file.mimetype,
      }));

      res.status(200).json({ attachments });
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const { title, content, target, tags, showAuthor, attachments, externalLink } = req.body;
      
      let authorName = "Anonymous";
      if (user.role === "STUDENT") {
        const student = await prisma.student.findUnique({ where: { id: user.id } });
        authorName = student?.name || "Student";
      } else if (user.role === "TEACHER") {
        const teacher = await prisma.teacher.findUnique({ where: { id: user.teacherId } });
        authorName = teacher?.name || user.email || "Teacher";
      } else {
        authorName = "Administrator";
      }

      const notice = await noticeService.createNotice({
        title,
        content,
        postedBy: user.id,
        authorName,
        authorRole: user.role,
        showAuthor: showAuthor,
        target: target as NoticeTarget,
        tags,
        attachments,
        externalLink,
      });

      res.status(201).json(notice);
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const notices = await noticeService.getNotices(user?.role);
      res.status(200).json(notices);
    } catch (error) {
      next(error);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) return res.status(400).json({ message: "Notice id is required" });
      await noticeService.deleteNotice(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  async report(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) return res.status(400).json({ message: "Notice id is required" });
      const user = (req as any).user;
      const notice = await noticeService.reportNotice(id, user.id);
      res.status(200).json(notice);
    } catch (error) {
      next(error);
    }
  },

  async restore(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) return res.status(400).json({ message: "Notice id is required" });
      const notice = await noticeService.restoreNotice(id);
      res.status(200).json(notice);
    } catch (error) {
      next(error);
    }
  },
};
