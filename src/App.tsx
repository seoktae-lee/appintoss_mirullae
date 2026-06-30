import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ClipboardCheck,
  Flame,
  Plus,
  Settings,
  Share2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { shareMirullae } from './tossBridge';

type Unit = '페이지' | '강의' | '문제' | '회' | '개';
type DayStatus = 'done' | 'partial' | 'skipped';

type Chapter = {
  id: string;
  title: string;
  amount: number;
};

type Goal = {
  id: string;
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
};

type FactResult = {
  goalId: string;
  title: string;
  unit: Unit;
  postponed: number;
  nextQuota: number;
  remaining: number;
  count: number;
  dday: number;
};

const units: Unit[] = ['페이지', '강의', '문제', '회', '개'];
const storageKey = 'mirullae:v1';
const today = () => new Date().toISOString().slice(0, 10);
const asset = (path: string) => `/assets/${path}`;

const starterGoals: Goal[] = [
  {
    id: crypto.randomUUID(),
    title: 'SQLD 자격증',
    deadline: addDays(17),
    total: 40,
    unit: '강의',
    completed: 23,
    postponedTotal: 0,
    postponeCount: 0,
    createdAt: today(),
    logs: {},
  },
];

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayDiff(date: string) {
  const start = new Date(`${today()}T00:00:00`);
  const end = new Date(`${date}T00:00:00`);
  return Math.ceil((end.getTime() - start.getTime()) / 86400000);
}

function quota(goal: Goal) {
  const remaining = Math.max(goal.total - goal.completed, 0);
  const days = Math.max(dayDiff(goal.deadline), 1);
  return Number((remaining / days).toFixed(1));
}

function projectedQuota(remaining: number, dday: number, extraSkippedDays: number) {
  const days = Math.max(dday - extraSkippedDays, 1);
  return Number((remaining / days).toFixed(1));
}

function formatAmount(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function todayPlan(goal: Goal, amount = quota(goal)) {
  if (!goal.chapters?.length) return [];

  const start = goal.completed;
  const end = Math.min(goal.total, start + amount);
  let cursor = 0;

  return goal.chapters.flatMap((chapter) => {
    const chapterStart = cursor;
    const chapterEnd = cursor + chapter.amount;
    cursor = chapterEnd;

    const from = Math.max(start, chapterStart);
    const to = Math.min(end, chapterEnd);
    if (from >= to) return [];

    const rangeStart = Math.floor(from - chapterStart) + 1;
    const rangeEnd = Math.ceil(to - chapterStart);
    const range = rangeStart === rangeEnd ? `${rangeStart}${goal.unit}` : `${rangeStart}~${rangeEnd}${goal.unit}`;

    return [{ title: chapter.title, range }];
  });
}

function todayLog(goal: Goal) {
  return goal.logs[today()];
}

function todayActionLabel(status: DayStatus) {
  if (status === 'done') return '오늘 완료했어요';
  if (status === 'partial') return '오늘 조금 했어요';
  return '오늘 미뤘어요';
}

function characterFor(count: number, happy = false) {
  if (happy) return asset('characters/happy_1.png');
  if (count <= 0) return asset('characters/happy_2.png');
  if (count <= 2) return asset(`characters/worst_${count}.png`);
  if (count <= 4) return asset(`characters/worst_${count}.png`);
  if (count <= 7) return asset(`characters/worst_${count}.png`);
  return asset('characters/worst_8.png');
}

function factLine(count: number, amount: number, unit: Unit) {
  if (count <= 1) return `괜찮아, 내일 ${formatAmount(amount)}${unit}씩이면 돼. 아직은.`;
  if (count === 2) return `오늘도 미뤘네? 내일부터 ${formatAmount(amount)}${unit}야.`;
  if (count <= 4) return `야... ${formatAmount(amount)}${unit}인데 괜찮아?`;
  return `...나도 모르겠다. 내일부터 ${formatAmount(amount)}${unit}.`;
}

function loadGoals() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return starterGoals;

  try {
    return JSON.parse(raw) as Goal[];
  } catch {
    return starterGoals;
  }
}

function weekDays() {
  const now = new Date();
  const day = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

function App() {
  const [goals, setGoals] = useState<Goal[]>(loadGoals);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAddOpen, setAddOpen] = useState(false);
  const [partialGoal, setPartialGoal] = useState<Goal | null>(null);
  const [partialAmount, setPartialAmount] = useState(0);
  const [fact, setFact] = useState<FactResult | null>(null);
  const [doneGoal, setDoneGoal] = useState<Goal | null>(null);
  const [toast, setToast] = useState('');

  const activeGoals = useMemo(() => goals.filter((goal) => dayDiff(goal.deadline) >= 0), [goals]);
  const totalPostpones = activeGoals.reduce((sum, goal) => sum + goal.postponeCount, 0);
  const health = Math.max(0, 100 - totalPostpones * 12);
  const activeGoal = activeGoals[Math.min(activeIndex, Math.max(activeGoals.length - 1, 0))];

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    if (activeIndex > activeGoals.length - 1) setActiveIndex(Math.max(activeGoals.length - 1, 0));
  }, [activeGoals.length, activeIndex]);

  function updateGoal(goalId: string, updater: (goal: Goal) => Goal) {
    setGoals((items) => items.map((goal) => (goal.id === goalId ? updater(goal) : goal)));
  }

  function createGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (goals.length >= 3) {
      setToast('목표는 3개까지만 가능해!');
      return;
    }

    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') ?? '').trim();
    const deadline = String(form.get('deadline') ?? '');
    const total = Number(form.get('total'));
    const unit = String(form.get('unit')) as Unit;
    const chapterTitles = form.getAll('chapterTitle').map((value) => String(value).trim());
    const chapterAmounts = form.getAll('chapterAmount').map((value) => Number(value));
    const chapters = chapterTitles
      .map((title, index) => ({ id: crypto.randomUUID(), title, amount: chapterAmounts[index] }))
      .filter((chapter) => chapter.title && chapter.amount > 0);
    const detailMode = form.get('detailMode') === 'on';
    const resolvedTotal = detailMode ? chapters.reduce((sum, chapter) => sum + chapter.amount, 0) : total;

    if (!title || !deadline || !resolvedTotal || dayDiff(deadline) <= 0) {
      setToast('미션명, 내일 이후 마감일, 총 분량을 확인해줘.');
      return;
    }

    if (detailMode && chapters.length === 0) {
      setToast('상세 목표는 단원을 1개 이상 넣어줘.');
      return;
    }

    const goal: Goal = {
      id: crypto.randomUUID(),
      title,
      deadline,
      total: resolvedTotal,
      unit,
      chapters: detailMode ? chapters : undefined,
      completed: 0,
      postponedTotal: 0,
      postponeCount: 0,
      createdAt: today(),
      logs: {},
    };

    setGoals((items) => [...items, goal]);
    setActiveIndex(goals.length);
    setAddOpen(false);
    event.currentTarget.reset();
  }

  function markDone(goal: Goal) {
    if (todayLog(goal)) {
      setToast('이 목표는 오늘 이미 선택했어. 내일 다시 와!');
      return;
    }

    const amount = quota(goal);
    updateGoal(goal.id, (item) => ({
      ...item,
      completed: Math.min(item.total, item.completed + amount),
      logs: { ...item.logs, [today()]: { status: 'done', amount } },
    }));
    setDoneGoal(goal);
  }

  function postpone(goal: Goal, doneAmount = 0) {
    if (todayLog(goal)) {
      setToast('이 목표는 오늘 이미 선택했어. 내일 다시 와!');
      setPartialGoal(null);
      return;
    }

    const dailyQuota = quota(goal);
    const skipped = Math.max(dailyQuota - doneAmount, 0);
    const nextCompleted = Math.min(goal.total, goal.completed + doneAmount);
    const nextRemaining = Math.max(goal.total - nextCompleted, 0);
    const nextDays = Math.max(dayDiff(goal.deadline) - 1, 1);
    const nextQuota = Number((nextRemaining / nextDays).toFixed(1));
    const status: DayStatus = doneAmount > 0 ? 'partial' : 'skipped';

    updateGoal(goal.id, (item) => ({
      ...item,
      completed: nextCompleted,
      postponedTotal: item.postponedTotal + skipped,
      postponeCount: item.postponeCount + 1,
      logs: { ...item.logs, [today()]: { status, amount: doneAmount } },
    }));

    setPartialGoal(null);
    setFact({
      goalId: goal.id,
      title: goal.title,
      unit: goal.unit,
      postponed: skipped,
      nextQuota,
      remaining: nextRemaining,
      count: goal.postponeCount + 1,
      dday: dayDiff(goal.deadline),
    });
  }

  function removeGoal(goalId: string) {
    if (!window.confirm('이 목표를 삭제할까?')) return;
    setGoals((items) => items.filter((goal) => goal.id !== goalId));
  }

  async function shareFact() {
    if (!fact) return;
    await shareMirullae({
      title: '미룰래 팩트폭행',
      text: `${fact.title}: 오늘 ${formatAmount(fact.postponed)}${fact.unit} 미루니까 내일부터 ${formatAmount(
        fact.nextQuota,
      )}${fact.unit}씩!`,
    });
    setToast('공유 준비 완료!');
  }

  const ringStyle = {
    background: `conic-gradient(${health > 70 ? '#22c55e' : health > 40 ? '#f59e0b' : '#ef4444'} ${health}%, #e5e8ef 0)`,
  };

  return (
    <main className="app-shell">
      <section className={`app ${fact ? 'app-alert' : ''}`}>
        <header className="topbar">
          <img className="brand-mark" src={asset('brand/logo.png')} alt="" />
          <div>
            <p className="eyebrow">Mirullae</p>
            <h1>미룰래</h1>
          </div>
          <div className="top-actions">
            <button className="icon-button" aria-label="설정">
              <Settings size={19} />
            </button>
            <button className="icon-button primary" aria-label="목표 추가" onClick={() => setAddOpen(true)}>
              <Plus size={20} />
            </button>
          </div>
        </header>

        {activeGoals.length === 0 ? (
          <EmptyState onAdd={() => setAddOpen(true)} />
        ) : (
          <>
            <section className="hero">
              <div className="character-stage">
                <img src={characterFor(totalPostpones)} alt="" />
              </div>
              <div className="hero-copy">
                <h2>{totalPostpones === 0 ? '오늘도 파이팅!' : '숫자는 거짓말 안 해.'}</h2>
                <p>목표 {activeGoals.length}개 · 미루기 {totalPostpones}회</p>
              </div>
            </section>

            <section className="score-row">
              <div className="score-ring" style={ringStyle}>
                <div>
                  <strong>{health}</strong>
                  <span>{health > 70 ? '양호' : health > 40 ? '위험' : '비상'}</span>
                </div>
              </div>
              <div className="score-copy">
                <p className="section-label">미루기 지수</p>
                <h3>{health > 70 ? '아직 꽤 멀쩡해' : health > 40 ? '내일이 무거워지는 중' : '마감이 너를 보고 있어'}</h3>
                <p>할당량은 매일 00:00 기준으로 다시 계산돼요.</p>
              </div>
            </section>

            <div className="dots" aria-label="목표 페이지">
              {activeGoals.map((goal, index) => (
                <button
                  key={goal.id}
                  className={index === activeIndex ? 'active' : ''}
                  aria-label={`${index + 1}번째 목표`}
                  onClick={() => setActiveIndex(index)}
                />
              ))}
            </div>

            {activeGoal && (
              <GoalCard
                goal={activeGoal}
                onPrev={() => setActiveIndex((index) => Math.max(index - 1, 0))}
                onNext={() => setActiveIndex((index) => Math.min(index + 1, activeGoals.length - 1))}
                onDone={() => markDone(activeGoal)}
                onPartial={() => {
                  setPartialGoal(activeGoal);
                  setPartialAmount(Math.min(quota(activeGoal), 1));
                }}
                onPostpone={() => postpone(activeGoal)}
                onRemove={() => removeGoal(activeGoal.id)}
                hasPrev={activeIndex > 0}
                hasNext={activeIndex < activeGoals.length - 1}
              />
            )}

            <WeekCalendar goals={activeGoals} />
          </>
        )}

        {isAddOpen && <AddSheet onClose={() => setAddOpen(false)} onSubmit={createGoal} />}
        {partialGoal && (
          <PartialSheet
            goal={partialGoal}
            amount={partialAmount}
            onAmount={setPartialAmount}
            onClose={() => setPartialGoal(null)}
            onSubmit={() => postpone(partialGoal, partialAmount)}
          />
        )}
        {fact && <FactScreen fact={fact} onBack={() => setFact(null)} onShare={shareFact} />}
        {doneGoal && <DoneScreen goal={doneGoal} onClose={() => setDoneGoal(null)} />}
        {toast && <Toast message={toast} onDone={() => setToast('')} />}
      </section>
    </main>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <section className="empty">
      <img src={asset('characters/happy_1.png')} alt="" />
      <h2>나랑 같이 벼락치기 해볼래?</h2>
      <p>미션명, 마감일, 총 분량만 넣으면 오늘 할당량을 바로 계산해줄게.</p>
      <button className="button primary" onClick={onAdd}>
        <Plus size={19} />
        목표 만들기
      </button>
    </section>
  );
}

function GoalCard({
  goal,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onDone,
  onPartial,
  onPostpone,
  onRemove,
}: {
  goal: Goal;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onDone: () => void;
  onPartial: () => void;
  onPostpone: () => void;
  onRemove: () => void;
}) {
  const progress = Math.min(100, Math.round((goal.completed / goal.total) * 100));
  const plan = todayPlan(goal);
  const log = todayLog(goal);

  return (
    <section className="goal-card">
      <div className="goal-nav">
        <button className="icon-button" onClick={onPrev} disabled={!hasPrev} aria-label="이전 목표">
          <ChevronLeft size={18} />
        </button>
        <button className="icon-button" onClick={onNext} disabled={!hasNext} aria-label="다음 목표">
          <ChevronLeft className="flip" size={18} />
        </button>
      </div>
      <div className="goal-head">
        <div>
          <p className="section-label">D-{Math.max(dayDiff(goal.deadline), 0)}</p>
          <h3>{goal.title}</h3>
        </div>
        <button className="icon-button danger" aria-label="목표 삭제" onClick={onRemove}>
          <Trash2 size={18} />
        </button>
      </div>
      <div className="quota">
        <span>오늘</span>
        <strong>
          {formatAmount(quota(goal))}
          <small>{goal.unit}</small>
        </strong>
      </div>
      <div className="progress">
        <span style={{ width: `${progress}%` }} />
      </div>
      <p className="progress-copy">
        {formatAmount(goal.completed)} / {formatAmount(goal.total)} {goal.unit} 완료 ({progress}%)
      </p>
      {plan.length > 0 && (
        <div className="today-plan">
          <p>오늘 범위</p>
          {plan.map((item) => (
            <span key={`${item.title}-${item.range}`}>
              {item.title} · {item.range}
            </span>
          ))}
        </div>
      )}
      {log && <p className="daily-lock">{todayActionLabel(log.status)}</p>}
      <div className="actions">
        <button className="button success" onClick={onDone} disabled={Boolean(log)}>
          <Check size={18} />
          했어요
        </button>
        <button className="button quiet" onClick={onPartial} disabled={Boolean(log)}>
          <ClipboardCheck size={18} />
          조금
        </button>
        <button className="button danger" onClick={onPostpone} disabled={Boolean(log)}>
          <X size={18} />
          미룰래
        </button>
      </div>
    </section>
  );
}

function WeekCalendar({ goals }: { goals: Goal[] }) {
  return (
    <section className="week-card">
      <div className="week-head">
        <h3>이번 주</h3>
        <CalendarDays size={18} />
      </div>
      <div className="week-grid">
        {['월', '화', '수', '목', '금', '토', '일'].map((day) => (
          <span key={day} className="weekday">
            {day}
          </span>
        ))}
        {weekDays().map((date) => {
          const logs = goals.map((goal) => goal.logs[date]).filter(Boolean);
          const skipped = logs.some((log) => log.status === 'skipped');
          const partial = logs.some((log) => log.status === 'partial');
          const done = logs.some((log) => log.status === 'done');
          const label = skipped ? 'worst' : partial ? 'partial' : done ? 'done' : '';

          return (
            <div className={`day ${label}`} key={date}>
              <span>{skipped ? '!' : partial ? '~' : done ? '✓' : date === today() ? '•' : ''}</span>
              <small>{date.slice(8)}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AddSheet({ onClose, onSubmit }: { onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  const [detailMode, setDetailMode] = useState(false);
  const [chapters, setChapters] = useState([{ id: crypto.randomUUID(), title: '', amount: '' }]);
  const detailedTotal = chapters.reduce((sum, chapter) => sum + Number(chapter.amount || 0), 0);

  function updateChapter(id: string, field: 'title' | 'amount', value: string) {
    setChapters((items) => items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <form className="sheet" onSubmit={onSubmit}>
        <div className="sheet-bar" />
        <div className="sheet-head">
          <div>
            <p className="section-label">10초 설정</p>
            <h2>목표 추가</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="닫기">
            <X size={20} />
          </button>
        </div>
        <label>
          미션명
          <input name="title" placeholder="예: SQLD 자격증" maxLength={18} required />
        </label>
        <label>
          마감일
          <input name="deadline" type="date" min={addDays(1)} required />
        </label>
        <div className="field-row">
          <label>
            총 분량
            <input
              name="total"
              type="number"
              min="1"
              inputMode="decimal"
              placeholder="40"
              required={!detailMode}
              disabled={detailMode}
              value={detailMode ? detailedTotal || '' : undefined}
              readOnly={detailMode}
            />
          </label>
          <label>
            단위
            <select name="unit" defaultValue="페이지">
              {units.map((unit) => (
                <option key={unit}>{unit}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="detail-toggle">
          <input
            name="detailMode"
            type="checkbox"
            checked={detailMode}
            onChange={(event) => setDetailMode(event.target.checked)}
          />
          <span>
            <strong>단원별로 나눌래요</strong>
            <small>총 분량 대신 주제별 분량으로 오늘 범위를 계산해요.</small>
          </span>
        </label>
        {detailMode && (
          <div className="chapter-list">
            {chapters.map((chapter, index) => (
              <div className="chapter-row" key={chapter.id}>
                <label>
                  단원 {index + 1}
                  <input
                    name="chapterTitle"
                    placeholder="예: SQL 기본 문법"
                    value={chapter.title}
                    onChange={(event) => updateChapter(chapter.id, 'title', event.target.value)}
                  />
                </label>
                <label>
                  분량
                  <input
                    name="chapterAmount"
                    type="number"
                    min="1"
                    inputMode="decimal"
                    placeholder="20"
                    value={chapter.amount}
                    onChange={(event) => updateChapter(chapter.id, 'amount', event.target.value)}
                  />
                </label>
              </div>
            ))}
            <div className="chapter-actions">
              <button
                className="button quiet compact"
                type="button"
                onClick={() => setChapters((items) => [...items, { id: crypto.randomUUID(), title: '', amount: '' }])}
              >
                <Plus size={16} />
                단원 추가
              </button>
              {chapters.length > 1 && (
                <button className="button quiet compact" type="button" onClick={() => setChapters((items) => items.slice(0, -1))}>
                  마지막 삭제
                </button>
              )}
            </div>
          </div>
        )}
        <button className="button primary wide" type="submit">
          <Plus size={19} />
          목표 추가하기
        </button>
      </form>
    </div>
  );
}

function PartialSheet({
  goal,
  amount,
  onAmount,
  onClose,
  onSubmit,
}: {
  goal: Goal;
  amount: number;
  onAmount: (value: number) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const dailyQuota = quota(goal);

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="sheet">
        <div className="sheet-bar" />
        <div className="sheet-head">
          <div>
            <p className="section-label">{goal.title}</p>
            <h2>얼마나 했어?</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="닫기">
            <X size={20} />
          </button>
        </div>
        <div className="range-value">
          <strong>{formatAmount(amount)}</strong>
          <span>/ {formatAmount(dailyQuota)} {goal.unit}</span>
        </div>
        <input
          aria-label="진행량"
          type="range"
          min="0"
          max={dailyQuota}
          step="0.1"
          value={amount}
          onChange={(event) => onAmount(Number(event.target.value))}
        />
        <button className="button primary wide" type="button" onClick={onSubmit}>
          <Flame size={19} />
          남은 분량 재계산
        </button>
      </div>
    </div>
  );
}

function FactScreen({ fact, onBack, onShare }: { fact: FactResult; onBack: () => void; onShare: () => void }) {
  const projections = [
    { label: '내일도 미루면', value: projectedQuota(fact.remaining, fact.dday, 2) },
    { label: '모레도 미루면', value: projectedQuota(fact.remaining, fact.dday, 3) },
  ];

  return (
    <section className="fact-screen">
      <button className="back-button" onClick={onBack} aria-label="돌아가기">
        <ChevronLeft size={22} />
      </button>
      <div className="fact-character">
        <img src={characterFor(fact.count)} alt="" />
      </div>
      <p className="section-label">팩트폭행 #{fact.count}</p>
      <h2>{fact.title}</h2>
      <p className="fact-number">
        {formatAmount(fact.nextQuota)}
        <small>{fact.unit}</small>
      </p>
      <p className="fact-copy">{factLine(fact.count, fact.nextQuota, fact.unit)}</p>
      <div className="fact-meta">
        <span>오늘 미룸 {formatAmount(fact.postponed)}{fact.unit}</span>
        <span>D-{Math.max(fact.dday, 0)}</span>
      </div>
      <div className="fact-projections">
        <p>여기서 더 미루면</p>
        <div>
          {projections.map((item) => (
            <span key={item.label}>
              {item.label} <strong>{formatAmount(item.value)}{fact.unit}</strong>
            </span>
          ))}
        </div>
      </div>
      <div className="fact-actions">
        <button className="button light" onClick={onShare}>
          <Share2 size={18} />
          공유하기
        </button>
        <button className="button dark" onClick={onBack}>
          돌아가기
        </button>
      </div>
    </section>
  );
}

function DoneScreen({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  return (
    <div className="overlay celebration" role="dialog" aria-modal="true">
      <section className="done-card">
        <img src={characterFor(0, true)} alt="" />
        <Sparkles size={28} />
        <h2>잘했어! 오늘 할당량 클리어!</h2>
        <p>{goal.title}의 오늘 분량을 완료했어요.</p>
        <button className="button primary wide" onClick={onClose}>
          확인
        </button>
      </section>
    </div>
  );
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 2200);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return <div className="toast">{message}</div>;
}

export default App;
