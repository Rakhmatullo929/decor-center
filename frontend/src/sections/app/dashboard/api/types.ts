import type { ModuleCode } from '../../results/api/types';

/** Matches `DashboardStatsView` response (camelCase). */
export type DashboardStats = {
  date: string;
  tests: {
    total: number;
    passed: number;
    failed: number;
    inProgress: number;
    byModule: { module: ModuleCode; total: number; passed: number }[];
  };
  medical: {
    total: number;
    approved: number;
    rejected: number;
  };
  totals: {
    activeEmployees: number;
    approvedQuestions: number;
    draftQuestions: number;
    instructions: number;
  };
};

export type DashboardStatsParams = {
  /** YYYY-MM-DD; omitted -> today. */
  date?: string;
};
