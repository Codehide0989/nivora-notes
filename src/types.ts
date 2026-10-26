export type NoteColor = 'none' | 'yellow' | 'orange' | 'pink' | 'mint' | 'sky' | 'violet';
export type NoteKind = 'note' | 'checklist' | 'voice';
export type Priority = 'low' | 'medium' | 'high';
export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Attachment {
  id: string;
  type: 'image' | 'audio';
  uri: string;
  name?: string;
  duration?: number; // seconds, audio only
}

export interface Note {
  id: string;
  title: string;
  body: string;
  kind: NoteKind;
  categoryId: string | null;
  color: NoteColor;
  pinned: boolean;
  locked: boolean;
  tags: string[];
  attachments: Attachment[];
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  sharedAt: number | null;
  dirty: boolean;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: NoteColor;
  builtin?: boolean;
  updatedAt?: number;
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  notes: string;
  done: boolean;
  doneAt: number | null;
  dueAt: number | null;
  priority: Priority;
  categoryId: string | null;
  subtasks: Subtask[];
  createdAt: number;
  updatedAt: number;
  dirty: boolean;
}

export interface Reminder {
  id: string;
  title: string;
  notes: string;
  at: number;
  repeat: Repeat;
  noteId: string | null;
  done: boolean;
  notificationId: string | null;
  createdAt: number;
  updatedAt?: number;
}

export interface ShareEntry {
  id: string;
  noteId: string;
  channel: 'text' | 'file' | 'copy' | 'export';
  at: number;
}

export interface Snapshot {
  version: 1;
  exportedAt: number;
  app: 'nivora-notes';
  notes: Note[];
  categories: Category[];
  tasks: Task[];
  reminders: Reminder[];
  shareLog: ShareEntry[];
  settings?: Record<string, unknown>;
  media?: Record<string, string>; // attachment id -> base64
}

export type VaultCategory = 'social' | 'email' | 'banking' | 'shopping' | 'work' | 'other';

export interface VaultItem {
  id: string;
  title: string;
  url: string;
  username: string;
  password: string;
  notes: string;
  category: VaultCategory;
  favourite: boolean;
  createdAt: number;
  updatedAt: number;
  passwordChangedAt: number;
}
