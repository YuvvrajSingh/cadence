import { prisma } from "../prisma/client";
import { NoticeTarget, Role } from "@prisma/client";

interface NoticeAttachment {
  url: string;
  type: string;
  name: string;
}

export const noticeService = {
  async createNotice(data: {
    title: string;
    content: string;
    postedBy: string;
    authorName: string;
    authorRole: Role;
    target: NoticeTarget;
    tags?: string[];
    showAuthor?: boolean;
    attachments?: NoticeAttachment[];
    externalLink?: string;
  }) {
    return prisma.notice.create({
      data: {
        title: data.title,
        content: data.content,
        postedBy: data.postedBy,
        authorName: data.authorName,
        authorRole: data.authorRole,
        showAuthor: data.showAuthor ?? true,
        target: data.target,
        tags: data.tags || [],
        attachments: data.attachments || [],
        externalLink: data.externalLink,
      },
    });
  },

  async getNotices(role?: string) {
    let whereClause = {};
    if (role === "TEACHER") {
      whereClause = { target: { in: ["ALL", "TEACHERS"] } };
    } else if (role === "STUDENT") {
      whereClause = { target: { in: ["ALL", "STUDENTS"] } };
    }

    const notices = await prisma.notice.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    });

    // Fallback for existing notices
    const processedNotices = notices.map(n => ({
      ...n,
      authorName: n.authorName || "Department Staff",
      authorRole: n.authorRole || "ADMIN",
    }));

    // If student, filter out archived notices
    if (role === "STUDENT") {
      return processedNotices.filter(n => !n.isArchived);
    }

    return processedNotices;
  },

  async deleteNotice(id: string) {
    return prisma.notice.delete({
      where: { id },
    });
  },

  async reportNotice(id: string, userId: string) {
    const notice = await prisma.notice.findUnique({ where: { id } });
    if (!notice) throw new Error("Notice not found");
    if (notice.isProtected) return notice; 
    if (notice.reporterIds.includes(userId)) return notice; 

    const newReportCount = notice.reportCount + 1;
    const shouldArchive = newReportCount >= 5;

    return prisma.notice.update({
      where: { id },
      data: {
        reportCount: newReportCount,
        reporterIds: { push: userId },
        isArchived: notice.isArchived || shouldArchive,
      },
    });
  },

  async restoreNotice(id: string) {
    return prisma.notice.update({
      where: { id },
      data: {
        isArchived: false,
        isProtected: true,
        reportCount: 0,
      },
    });
  },
};
