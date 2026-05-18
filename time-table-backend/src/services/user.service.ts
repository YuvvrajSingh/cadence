import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { Role } from "@prisma/client";
import { prisma } from "../prisma/client";
import { AppError } from "../utils/AppError";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type CreateUserInput = {
  email: string;
  password: string;
  role: Role;
  isTimetableIncharge?: boolean;
  teacherId?: string;
};

export const userService = {
  async createUser(input: CreateUserInput) {
    const email = normalizeEmail(input.email);

    if (input.role === "TEACHER" && (input.teacherId === undefined || input.teacherId === null)) {
      throw new AppError("Teacher accounts require teacherId", 400, "VALIDATION_ERROR");
    }
    if (input.role === "ADMIN" && input.teacherId != null) {
      throw new AppError("Admin accounts must not have teacherId", 400, "VALIDATION_ERROR");
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError("An account with this email already exists", 409, "CONFLICT");
    }

    if (input.role === "TEACHER") {
      const teacherId = input.teacherId as string;
      const linked = await prisma.user.findUnique({ where: { teacherId } });
      if (linked) {
        throw new AppError("This teacher already has a login account", 409, "CONFLICT");
      }

      const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
      if (!teacher) {
        throw new AppError("Teacher not found", 404, "NOT_FOUND");
      }

      const tEmail = teacher.email?.trim().toLowerCase() ?? null;
      if (tEmail !== null && tEmail !== email) {
        throw new AppError(
          "Email must match the teacher's academic email on file",
          400,
          "VALIDATION_ERROR",
        );
      }

      const passwordHash = await bcrypt.hash(input.password, 12);

      return prisma.$transaction(async (tx) => {
        if (tEmail === null) {
          await tx.teacher.update({
            where: { id: teacherId },
            data: { email },
          });
        }

        const data: Prisma.UserCreateInput = {
          email,
          passwordHash,
          role: Role.TEACHER,
          isTimetableIncharge: input.isTimetableIncharge ?? false,
          isActive: true,
          teacher: { connect: { id: teacherId } },
        };
        return tx.user.create({ data });
      });
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const data: Prisma.UserCreateInput = {
      email,
      passwordHash,
      role: input.role,
      isTimetableIncharge: input.isTimetableIncharge ?? false,
      isActive: true,
    };
    if (input.teacherId) {
      data.teacher = { connect: { id: input.teacherId } };
    }
    return prisma.user.create({ data });
  },

  async listUsers() {
    return prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        isTimetableIncharge: true,
        teacherId: true,
        isActive: true,
        createdAt: true,
        teacher: {
          select: { id: true, name: true, abbreviation: true },
        },
      },
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
    });
  },

  async deleteUser(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppError("User not found", 404, "NOT_FOUND");
    }
    // Hard delete - allows creating the user again with same email/teacher link
    return prisma.user.delete({
      where: { id },
    });
  },

  async updateUser(id: string, data: { role?: Role; isActive?: boolean; isTimetableIncharge?: boolean }) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppError("User not found", 404, "NOT_FOUND");
    }
    return prisma.user.update({
      where: { id },
      data,
    });
  },
};

