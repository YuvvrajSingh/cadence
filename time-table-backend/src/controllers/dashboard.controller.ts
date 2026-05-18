import { Request, Response, NextFunction } from "express";
import { dashboardService } from "../services/dashboard.service";

export const dashboardController = {
  async getMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const academicYearId = (req.query.academicYearId as string) || undefined;
      const parityRaw = (req.query.semesterParity as string | undefined) || undefined;
      const semesterParity = parityRaw === "odd" || parityRaw === "even" ? parityRaw : undefined;
      const data = await dashboardService.getMetrics(academicYearId, semesterParity);
      res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  }
};
