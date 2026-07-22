export type Task = {
  id: string;
  text: string;
  createdAt: number;
  done: boolean;
  /** ISO date (YYYY-MM-DD) the task is scheduled for, or null if unscheduled. */
  dueDate: string | null;
  /** Time of day (HH:MM), or null if only a date (or nothing) is set. */
  dueTime: string | null;
};
