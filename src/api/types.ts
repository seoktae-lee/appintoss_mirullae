export type Unit = "페이지" | "강의" | "문제" | "회" | "개";
export type DayStatus = "done" | "partial" | "skipped";

export interface User {
  id: string;
  nickname: string | null;
  notificationAgreed: boolean;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface Chapter {
  id: string;
  title: string;
  amount: number;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  deadline: string;
  total: number;
  unit: Unit;
  chapters?: Chapter[];
  completed: number;
  postponedTotal: number;
  postponeCount: number;
  createdAt: string;
  logs: Record<string, { status: DayStatus; amount: number }>;
}
