export type Theme = "paper" | "monochrome" | "dark";
export type Category = {
  id: string;
  user_id: string;
  name: string;
  accent_color: string;
  position: number;
};
export type Task = {
  id: string;
  user_id: string;
  date: string;
  category_id: string;
  title: string;
  description: string;
  note: string;
  completed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
export type DayNote = {
  revision: number;
  id: string;
  user_id: string;
  date: string;
  content: string;
  created_at: string;
  updated_at: string;
};
export type DayStatus = {
  id: string;
  user_id: string;
  date: string;
  is_finished: boolean;
  finished_at: string | null;
};
export type WeekData = {
  tasks: Task[];
  notes: DayNote[];
  statuses: DayStatus[];
};
export type TaskInput = Pick<
  Task,
  "category_id" | "title" | "description" | "note"
>;
