export type TaskKind = 'todo' | 'recurring' | 'cadence' | 'friend';

export type CategoryKind = 'general' | 'friends';

export type CompletionStream = 'contacted' | 'seen';

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
	// Friend tasks only. Copied from the category's defaults on create,
	// stored per-task so each friend can be tuned independently.
	contactedTargetDays?: number;
	seenTargetDays?: number;
}

export interface Category {
	id: string;
	name: string;
	color: string;
	sortOrder: number;
	kind: CategoryKind;
	// Defaults for friend tasks created in this category. Only meaningful
	// when kind === 'friends'; ignored otherwise.
	defaultContactedDays?: number;
	defaultSeenDays?: number;
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
	// null/undefined = single-stream (todo / cadence / recurring).
	// Set to 'contacted' or 'seen' for friend tasks.
	stream?: CompletionStream;
}

export type TaskWithLast = Task & {
	lastCompletedAt: string | null;
	// Populated only for kind: 'friend'. lastCompletedAt is null for friends.
	lastContactedAt?: string | null;
	lastSeenAt?: string | null;
};
