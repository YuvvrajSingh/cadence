import { Request, Response } from "express";
import { prisma } from "../prisma/client";

// ─── POST /api/objections ─────────────────────────────────────────────────────
// Student submits a new objection.
export async function createObjection(req: Request, res: Response) {
  try {
    const {
      exam_id,
      exam_name,
      roll_number,
      student_name,
      question_numbers,
      reason,
    } = req.body as {
      exam_id: string | number;
      exam_name?: string;
      roll_number: string;
      student_name?: string;
      question_numbers: number[];
      reason: string;
    };

    if (!exam_id || !roll_number || !reason) {
      return res.status(400).json({ error: "exam_id, roll_number and reason are required." });
    }

    if (!Array.isArray(question_numbers) || question_numbers.length === 0) {
      return res.status(400).json({ error: "At least one question_number must be specified." });
    }

    const examIdNum = Number(exam_id);
    if (!Number.isFinite(examIdNum)) {
      return res.status(400).json({ error: "exam_id must be a valid integer." });
    }

    const parsedQuestionNumbers = question_numbers.map(Number);

    // Check for existing objections for these questions
    const existingObjections = await prisma.objections.findMany({
      where: {
        exam_id: examIdNum,
        roll_number: String(roll_number).trim().toUpperCase(),
      },
    });

    const alreadyObjectedQuestions = new Set<number>();
    for (const obj of existingObjections) {
      for (const q of obj.question_numbers) {
        alreadyObjectedQuestions.add(q);
      }
    }

    const duplicates = parsedQuestionNumbers.filter(q => alreadyObjectedQuestions.has(q));
    if (duplicates.length > 0) {
      return res.status(400).json({ 
        error: `You have already raised an objection for question(s): ${duplicates.join(", ")}` 
      });
    }

    const objection = await prisma.objections.create({
      data: {
        exam_id: examIdNum,
        exam_name: exam_name ?? null,
        roll_number: String(roll_number).trim().toUpperCase(),
        student_name: student_name ?? null,
        question_numbers: parsedQuestionNumbers,
        reason: String(reason).trim(),
        status: "PENDING",
      },
    });

    return res.status(201).json({ success: true, objection });
  } catch (err: any) {
    console.error("[objection.controller] createObjection error:", err);
    return res.status(500).json({ error: "Failed to submit objection." });
  }
}

// ─── GET /api/objections/my?exam_id=&roll_number= ─────────────────────────────
// Student fetches their own objections for a specific exam.
export async function getMyObjections(req: Request, res: Response) {
  try {
    const { exam_id, roll_number } = req.query as {
      exam_id?: string;
      roll_number?: string;
    };

    if (!roll_number) {
      return res.status(400).json({ error: "roll_number query param is required." });
    }

    const where: any = {
      roll_number: roll_number.trim().toUpperCase(),
    };

    if (exam_id) {
      const examIdNum = Number(exam_id);
      if (Number.isFinite(examIdNum)) {
        where.exam_id = examIdNum;
      }
    }

    const objections = await prisma.objections.findMany({
      where,
      orderBy: { created_at: "desc" },
    });

    return res.status(200).json({ objections });
  } catch (err: any) {
    console.error("[objection.controller] getMyObjections error:", err);
    return res.status(500).json({ error: "Failed to fetch objections." });
  }
}

// ─── GET /api/objections?exam_id=&status= ─────────────────────────────────────
// Teacher / Admin lists all objections (optional filters: exam_id, status).
export async function getAllObjections(req: Request, res: Response) {
  try {
    const { exam_id, status } = req.query as {
      exam_id?: string;
      status?: string;
    };

    const where: any = {};

    if (exam_id) {
      const examIdNum = Number(exam_id);
      if (Number.isFinite(examIdNum)) {
        where.exam_id = examIdNum;
      }
    }

    if (status && ["PENDING", "RESOLVED", "DISMISSED"].includes(status.toUpperCase())) {
      where.status = status.toUpperCase();
    }

    const objections = await prisma.objections.findMany({
      where,
      orderBy: { created_at: "desc" },
    });

    return res.status(200).json({ objections });
  } catch (err: any) {
    console.error("[objection.controller] getAllObjections error:", err);
    return res.status(500).json({ error: "Failed to fetch objections." });
  }
}

// ─── PATCH /api/objections/:id ────────────────────────────────────────────────
// Teacher / Admin updates status and optionally adds a reply.
export async function reviewObjection(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, teacher_reply } = req.body as {
      status: "RESOLVED" | "DISMISSED";
      teacher_reply?: string;
    };

    if (!id) {
      return res.status(400).json({ error: "Objection id is required." });
    }

    if (!status || !["RESOLVED", "DISMISSED"].includes(status)) {
      return res.status(400).json({ error: "status must be RESOLVED or DISMISSED." });
    }

    const updated = await prisma.objections.update({
      where: { id: String(id) },
      data: {
        status,
        teacher_reply: teacher_reply ? String(teacher_reply).trim() : null,
      },
    });

    return res.status(200).json({ success: true, objection: updated });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return res.status(404).json({ error: "Objection not found." });
    }
    console.error("[objection.controller] reviewObjection error:", err);
    return res.status(500).json({ error: "Failed to update objection." });
  }
}
