import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export interface UserRecord {
  id: string;
  anonymousKey: string;
  nickname: string | null;
  tossUserKey: number | null;
  notificationAgreed: boolean;
  createdAt: string;
}

export type Unit = "페이지" | "강의" | "문제" | "회" | "개";
export type DayStatus = "done" | "partial" | "skipped";

export interface ChapterRecord {
  id: string;
  title: string;
  amount: number;
}

export interface DailyLog {
  status: DayStatus;
  amount: number;
}

export interface GoalRecord {
  id: string;
  userId: string;
  title: string;
  deadline: string;
  total: number;
  unit: Unit;
  chapters?: ChapterRecord[];
  completed: number;
  postponedTotal: number;
  postponeCount: number;
  createdAt: string;
  logs: Record<string, DailyLog>;
}

interface StoreData {
  users: UserRecord[];
  goals: GoalRecord[];
}

const DB_PATH = path.join(process.env.DATA_DIR ?? process.cwd(), "mirullae-db.json");

function load(): StoreData {
  try {
    const raw = JSON.parse(fs.readFileSync(DB_PATH, "utf-8")) as StoreData & Record<string, unknown>;
    return {
      users: (raw.users ?? []).map((u) =>
        Object.assign({ nickname: null, tossUserKey: null, notificationAgreed: false }, u)
      ),
      goals: raw.goals ?? [],
    };
  } catch {
    return { users: [], goals: [] };
  }
}

function save(data: StoreData): void {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export const db = {
  // ── Users ─────────────────────────────────────────────────
  findUserByKey(anonymousKey: string): UserRecord | undefined {
    return load().users.find((u) => u.anonymousKey === anonymousKey);
  },
  findUserById(id: string): UserRecord | undefined {
    return load().users.find((u) => u.id === id);
  },
  findUserByTossKey(tossUserKey: number): UserRecord | undefined {
    return load().users.find((u) => u.tossUserKey === tossUserKey);
  },
  createUser(user: UserRecord): void {
    const data = load();
    data.users.push(user);
    save(data);
  },
  updateUser(id: string, updates: Partial<UserRecord>): void {
    const data = load();
    const idx = data.users.findIndex((u) => u.id === id);
    if (idx !== -1) {
      data.users[idx] = { ...data.users[idx], ...updates };
      save(data);
    }
  },
  setTossUserKey(id: string, tossUserKey: number): UserRecord | undefined {
    const data = load();
    const user = data.users.find((u) => u.id === id);
    if (!user) return undefined;
    user.tossUserKey = tossUserKey;
    save(data);
    return user;
  },
  deleteUser(id: string): void {
    const data = load();
    data.users = data.users.filter((u) => u.id !== id);
    data.goals = data.goals.filter((g) => g.userId !== id);
    save(data);
  },

  // ── Goals ─────────────────────────────────────────────────
  getGoals(userId: string): GoalRecord[] {
    return load()
      .goals.filter((g) => g.userId === userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  getGoalCount(userId: string): number {
    return load().goals.filter((g) => g.userId === userId).length;
  },
  findGoal(id: string, userId: string): GoalRecord | undefined {
    return load().goals.find((g) => g.id === id && g.userId === userId);
  },
  createGoal(goal: GoalRecord): void {
    const data = load();
    data.goals.push(goal);
    save(data);
  },
  updateGoal(id: string, userId: string, updates: Partial<Omit<GoalRecord, "id" | "userId">>): GoalRecord | undefined {
    const data = load();
    const goal = data.goals.find((g) => g.id === id && g.userId === userId);
    if (!goal) return undefined;
    Object.assign(goal, updates);
    save(data);
    return goal;
  },
  deleteGoal(id: string, userId: string): boolean {
    const data = load();
    const idx = data.goals.findIndex((g) => g.id === id && g.userId === userId);
    if (idx === -1) return false;
    data.goals.splice(idx, 1);
    save(data);
    return true;
  },
};

export { randomUUID };
