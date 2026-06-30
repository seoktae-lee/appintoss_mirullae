import { Router, Response } from "express";
import { db, randomUUID, GoalRecord, Unit, ChapterRecord } from "../db.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

const MAX_GOALS = 3;
const UNITS: Unit[] = ["페이지", "강의", "문제", "회", "개"];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function isActive(goal: GoalRecord): boolean {
  return goal.deadline >= today();
}

router.get("/", (req: AuthRequest, res: Response): void => {
  const goals = db.getGoals(req.userId!);
  res.json({ goals });
});

router.post("/", (req: AuthRequest, res: Response): void => {
  const activeCount = db.getGoals(req.userId!).filter(isActive).length;
  if (activeCount >= MAX_GOALS) {
    res.status(400).json({ error: "목표는 3개까지만 가능해!" });
    return;
  }

  const { title, deadline, total, unit, chapters } = req.body as {
    title: string;
    deadline: string;
    total: number;
    unit: Unit;
    chapters?: ChapterRecord[];
  };

  if (!title?.trim() || !deadline || deadline <= today() || !unit || !UNITS.includes(unit)) {
    res.status(400).json({ error: "미션명, 내일 이후 마감일, 단위를 확인해줘." });
    return;
  }

  const resolvedChapters = chapters?.filter((c) => c.title?.trim() && c.amount > 0);
  const resolvedTotal = resolvedChapters?.length
    ? resolvedChapters.reduce((sum, c) => sum + c.amount, 0)
    : Number(total);

  if (!resolvedTotal || resolvedTotal <= 0) {
    res.status(400).json({ error: "총 분량을 확인해줘." });
    return;
  }

  const goal: GoalRecord = {
    id: randomUUID(),
    userId: req.userId!,
    title: title.trim(),
    deadline,
    total: resolvedTotal,
    unit,
    chapters: resolvedChapters?.length ? resolvedChapters.map((c) => ({ ...c, id: c.id || randomUUID() })) : undefined,
    completed: 0,
    postponedTotal: 0,
    postponeCount: 0,
    createdAt: new Date().toISOString(),
    logs: {},
  };

  db.createGoal(goal);
  res.json({ success: true, goal });
});

router.patch("/:id", (req: AuthRequest, res: Response): void => {
  const updates = req.body as Partial<Omit<GoalRecord, "id" | "userId">>;
  const goal = db.updateGoal(req.params.id, req.userId!, updates);
  if (!goal) { res.status(404).json({ error: "목표를 찾을 수 없어요." }); return; }
  res.json({ success: true, goal });
});

router.delete("/:id", (req: AuthRequest, res: Response): void => {
  const deleted = db.deleteGoal(req.params.id, req.userId!);
  if (!deleted) { res.status(404).json({ error: "목표를 찾을 수 없어요." }); return; }
  res.json({ success: true });
});

export default router;
