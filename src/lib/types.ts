export type TaskKind = 'todo' | 'recurring' | 'cadence';

export type Period = 'day' | 'week' | 'month' | 'year';

export interface Recurrence {
	period: Period;
	every?: number;
	dueOn?: number | 'end';
}

export interface Cadence {
	targetIntervalDays: number;
}

export interface Task {
	id: string;
	title: string;
	notes?: string;
	tags?: string[];
	kind: TaskKind;
	categoryId?: string;
	createdAt: string;
	archivedAt?: string;
	updatedAt: string;
	deletedAt?: string;
	recurrence?: Recurrence;
	cadence?: Cadence;
}

export interface Category {
	id: string;
	name: string;
	color: string;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
	deletedAt?: string;
}

export interface Completion {
	id: string;
	taskId: string;
	at: string;
	updatedAt: string;
	deletedAt?: string;
}

export type TaskWithLast = Task & { lastCompletedAt: string | null };
