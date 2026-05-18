"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { AcademicYear } from "@/lib/types";
import { academicYearApi } from "@/lib/api";

interface AcademicYearContextType {
  academicYears: AcademicYear[];
  activeYear: AcademicYear | null;
  selectedYear: AcademicYear | null;
  isArchived: boolean;
  setSelectedYear: (year: AcademicYear) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AcademicYearContext = createContext<AcademicYearContextType | undefined>(undefined);

// Default storage key — can be overridden per portal via the storageKey prop.

export function AcademicYearProvider({
  children,
  storageKey = "timetable-selected-year-id",
  forceActive = false,
}: {
  children: React.ReactNode;
  storageKey?: string;
  forceActive?: boolean;
}) {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYear, setSelectedYearState] = useState<AcademicYear | null>(null);
  const [loading, setLoading] = useState(true);

  const activeYear = academicYears.find((y) => y.isActive) ?? null;

  const isArchived = selectedYear?.status === "ARCHIVED";

  const fetchYears = useCallback(async () => {
    try {
      setLoading(true);
      const years = await academicYearApi.list();
      setAcademicYears(years);

      // Restore from localStorage or default to active year
      if (!forceActive) {
        const savedYearId = localStorage.getItem(storageKey);
        if (savedYearId) {
          const found = years.find((y) => y.id === savedYearId);
          if (found) {
            setSelectedYearState(found);
            setLoading(false);
            return;
          }
        }
      }

      // Default to active year
      const active = years.find((y) => y.isActive);
      if (active) {
        setSelectedYearState(active);
        localStorage.setItem(storageKey, String(active.id));
      } else if (years.length > 0) {
        setSelectedYearState(years[0]);
        localStorage.setItem(storageKey, String(years[0].id));
      }
    } catch (err) {
      console.error("[AcademicYearContext] Failed to fetch academic years:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchYears();
  }, [fetchYears]);

  const setSelectedYear = useCallback((year: AcademicYear) => {
    setSelectedYearState(year);
    localStorage.setItem(storageKey, String(year.id));
  }, [storageKey]);

  return (
    <AcademicYearContext.Provider
      value={{
        academicYears,
        activeYear,
        selectedYear,
        isArchived,
        setSelectedYear,
        loading,
        refresh: fetchYears,
      }}
    >
      {children}
    </AcademicYearContext.Provider>
  );
}

export function useAcademicYear() {
  const ctx = useContext(AcademicYearContext);
  if (!ctx) {
    throw new Error("useAcademicYear must be used within an AcademicYearProvider");
  }
  return ctx;
}
