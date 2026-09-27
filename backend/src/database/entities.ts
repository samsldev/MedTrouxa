import {
  Column, CreateDateColumn, Entity, Index, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique,
} from 'typeorm';

export type Role = 'student' | 'admin';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Index({ unique: true }) @Column() email: string;
  @Column({ select: false }) passwordHash: string;
  @Column({ default: 'student' }) role: Role;
  @Column({ nullable: true }) university?: string;
  @Column({ type: 'int', nullable: true }) semester?: number;
  @Column({ type: 'int', default: 0 }) xp: number;
  /** Incrementado para revogar todas as sessões (troca de senha, reuso de refresh token, logout geral) */
  @Column({ type: 'int', default: 0, select: false }) tokenVersion: number;
  /** E-mail confirmado por código de 6 dígitos */
  @Column({ type: 'timestamptz', nullable: true }) emailVerifiedAt?: Date | null;
  /** Verificação em duas etapas: 'totp' (app autenticador) ou 'email' */
  @Column({ type: 'varchar', nullable: true }) twoFactorMethod?: 'totp' | 'email' | null;
  @Column({ type: 'timestamptz', nullable: true }) twoFactorEnabledAt?: Date | null;
  /** Segredo TOTP criptografado (AES-256-GCM) */
  @Column({ type: 'text', nullable: true, select: false }) totpSecretEnc?: string | null;
  /** Hashes SHA-256 dos códigos de recuperação ainda não usados */
  @Column({ type: 'jsonb', nullable: true, select: false }) recoveryCodes?: string[] | null;
  /** Aceite dos Termos de uso e Política de privacidade (LGPD art. 8º) */
  @Column({ type: 'timestamptz', nullable: true }) termsAcceptedAt?: Date | null;
  @Column({ nullable: true }) termsVersion?: string;
  @CreateDateColumn() createdAt: Date;
}

/** Grande área: Clínica Médica, Cirurgia, Pediatria, GO, Preventiva... */
@Entity('subjects')
export class Subject {
  @PrimaryGeneratedColumn() id: number;
  @Column({ unique: true }) name: string;
  @OneToMany(() => Topic, (t) => t.subject) topics: Topic[];
}

@Entity('topics')
export class Topic {
  @PrimaryGeneratedColumn() id: number;
  @Column() name: string;
  @ManyToOne(() => Subject, (s) => s.topics, { onDelete: 'CASCADE' }) subject: Subject;
  @Column() subjectId: number;
}

export interface Alternative { key: string; text: string }

@Entity('questions')
export class Question {
  @PrimaryGeneratedColumn() id: number;
  @Column('text') statement: string;
  @Column('jsonb') alternatives: Alternative[];
  @Column({ select: false }) correctKey: string;
  @Column({ type: 'text', select: false }) commentary: string;
  @ManyToOne(() => Topic, { eager: true, onDelete: 'CASCADE' }) topic: Topic;
  @Index() @Column() topicId: number;
  @Column({ nullable: true }) institution?: string;
  @Column({ type: 'int', nullable: true }) year?: number;
  @Column({ default: 'medium' }) difficulty: 'easy' | 'medium' | 'hard';
}

@Entity('answers')
export class Answer {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column() userId: string;
  @ManyToOne(() => Question, { onDelete: 'CASCADE' }) question: Question;
  @Column() questionId: number;
  @Column() chosenKey: string;
  @Column() correct: boolean;
  @Column({ type: 'uuid', nullable: true }) examId?: string | null;
  @CreateDateColumn() createdAt: Date;
}

@Entity('decks')
export class Deck {
  @PrimaryGeneratedColumn() id: number;
  @Column() name: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @ManyToOne(() => Topic, { nullable: true, eager: true, onDelete: 'SET NULL' }) topic?: Topic | null;
  @Column({ nullable: true }) topicId?: number | null;
  /** null = baralho público da plataforma */
  @Column({ type: 'uuid', nullable: true }) ownerId?: string | null;
  @OneToMany(() => Flashcard, (c) => c.deck) cards: Flashcard[];
}

@Entity('flashcards')
export class Flashcard {
  @PrimaryGeneratedColumn() id: number;
  @ManyToOne(() => Deck, (d) => d.cards, { onDelete: 'CASCADE' }) deck: Deck;
  @Index() @Column() deckId: number;
  @Column('text') front: string;
  @Column('text') back: string;
}

/** Estado de repetição espaçada (SM-2) de um card para um usuário */
@Entity('card_reviews')
@Unique(['userId', 'cardId'])
export class CardReview {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column() userId: string;
  @Column() cardId: number;
  @Column({ type: 'float', default: 2.5 }) ease: number;
  @Column({ type: 'int', default: 0 }) interval: number;
  @Column({ type: 'int', default: 0 }) repetitions: number;
  @Index() @Column({ type: 'timestamptz' }) dueAt: Date;
}

export interface ExamAnswer { questionId: number; chosenKey: string | null; correct: boolean }

/** Simulado */
@Entity('exams')
export class Exam {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() userId: string;
  @Column() title: string;
  @Column('jsonb') questionIds: number[];
  @Column({ type: 'int' }) durationMinutes: number;
  @CreateDateColumn() startedAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) finishedAt?: Date | null;
  @Column({ type: 'int', nullable: true }) score?: number | null;
  @Column({ type: 'jsonb', nullable: true }) answers?: ExamAnswer[] | null;
}

export interface PlanItem { day: number; title: string; type: 'questions' | 'flashcards' | 'reading' | 'review'; topicId?: number }

/** Cronograma de estudos */
@Entity('study_plans')
export class StudyPlan {
  @PrimaryGeneratedColumn() id: number;
  @Column() title: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @Column() goal: string; // ENAMED, Residência, Faculdade
  @Column('jsonb') items: PlanItem[];
}

@Entity('plan_enrollments')
@Unique(['userId', 'planId'])
export class PlanEnrollment {
  @PrimaryGeneratedColumn() id: number;
  @Column() userId: string;
  @ManyToOne(() => StudyPlan, { eager: true, onDelete: 'CASCADE' }) plan: StudyPlan;
  @Column() planId: number;
  @Column('jsonb', { default: [] }) completed: number[];
  /** Tarefas que já renderam XP (evita farm de XP marcando/desmarcando) */
  @Column('jsonb', { default: [] }) rewarded: number[];
  @CreateDateColumn() startedAt: Date;
}


/** Assinatura. `status` fica `active` após confirmação do pagamento (gateway em modo simulado por enquanto). */
@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() userId: string;
  @Column() planId: string;
  @Column() paymentMethod: 'pix' | 'card';
  @Column({ type: 'int' }) installments: number;
  /** Total cobrado, em centavos */
  @Column({ type: 'int' }) amount: number;
  @Column({ default: 'pending' }) status: 'pending' | 'active' | 'canceled' | 'failed';
  /** Provedor de pagamento e referência externa (ex.: id do pagamento no Mercado Pago) */
  @Column({ default: 'fake' }) provider: string;
  @Index({ unique: true, where: '"providerPaymentId" IS NOT NULL' }) @Column({ nullable: true }) providerPaymentId?: string;
  @CreateDateColumn() createdAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) paidAt?: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) startsAt?: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) expiresAt?: Date | null;
}

/** Depoimento/aprovação de aluno. Gerenciado pelo admin; `isDemo` marca conteúdo de exemplo (nunca em produção). */
@Entity('testimonials')
export class Testimonial {
  @PrimaryGeneratedColumn() id: number;
  @Column() name: string;
  /** Ex.: "UFTM", "Universidade Federal do Oeste da Bahia" */
  @Column({ nullable: true }) school?: string;
  @Column('text') quote: string;
  /** Especialidade em que foi aprovado(a), ex.: "Oftalmologia" */
  @Column({ nullable: true }) specialty?: string;
  /** Instituições da aprovação, ex.: "USP e UNIFESP" */
  @Column({ nullable: true }) institutions?: string;
  /** Resultado de destaque, ex.: "93 pontos no ENAMED" */
  @Column({ nullable: true }) highlight?: string;
  @Column({ type: 'int', default: 5 }) rating: number;
  @Column({ nullable: true }) photoUrl?: string;
  @Column({ nullable: true }) videoUrl?: string;
  /** Aparece nos cards grandes do topo */
  @Column({ default: false }) featured: boolean;
  /** Conta como aprovado(a) no mural de aprovados */
  @Column({ default: true }) approved: boolean;
  @Column({ default: true }) published: boolean;
  @Column({ default: false }) isDemo: boolean;
  @CreateDateColumn() createdAt: Date;
}

export const ENTITIES = [User, Subject, Topic, Question, Answer, Deck, Flashcard, CardReview, Exam, StudyPlan, PlanEnrollment, Subscription, Testimonial];
