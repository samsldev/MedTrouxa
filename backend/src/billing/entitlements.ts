import { PlanId } from './plans';

export type Tier = 'free' | PlanId;

export interface Limits {
  /** Questões respondidas por dia (null = ilimitado) */
  answersPerDay: number | null;
  exams: boolean;
  studyPlans: boolean;
  /** Mensagens para a Coruja por hora (0 = sem acesso) */
  aiPerHour: number;
}

/** Regras de acesso por plano. Fonte única de verdade para backend e frontend (GET /billing/me). */
export const LIMITS: Record<Tier, Limits> = {
  free: { answersPerDay: 20, exams: false, studyPlans: false, aiPerHour: 0 },
  aprendiz: { answersPerDay: null, exams: true, studyPlans: false, aiPerHour: 30 },
  alquimista: { answersPerDay: null, exams: true, studyPlans: true, aiPerHour: 90 },
  arcano: { answersPerDay: null, exams: true, studyPlans: true, aiPerHour: 90 },
};
