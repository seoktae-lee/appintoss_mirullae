import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Goal } from '../api/types';

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ goals: Goal[] }>('/api/goals');
      setGoals(res.goals);
    } catch (e) {
      console.error('[goals]', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function createGoal(payload: {
    title: string;
    deadline: string;
    total: number;
    unit: Goal['unit'];
    chapters?: Goal['chapters'];
  }) {
    const res = await api.post<{ goal: Goal }>('/api/goals', payload);
    setGoals((items) => [...items, res.goal]);
    return res.goal;
  }

  async function patchGoal(id: string, updates: Partial<Omit<Goal, 'id' | 'userId'>>) {
    const res = await api.patch<{ goal: Goal }>(`/api/goals/${id}`, updates);
    setGoals((items) => items.map((goal) => (goal.id === id ? res.goal : goal)));
    return res.goal;
  }

  async function removeGoal(id: string) {
    await api.delete(`/api/goals/${id}`);
    setGoals((items) => items.filter((goal) => goal.id !== id));
  }

  return { goals, isLoading, refresh, createGoal, patchGoal, removeGoal };
}
