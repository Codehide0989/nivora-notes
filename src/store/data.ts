import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uid } from '@/utils/id';
import type { Category, Note, Reminder, ShareEntry, Snapshot, Task } from '@/types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-personal', name: 'Personal', icon: 'account-heart', color: 'pink', builtin: true },
  { id: 'cat-work', name: 'Work', icon: 'briefcase', color: 'sky', builtin: true },
  { id: 'cat-travel', name: 'Travel', icon: 'airplane', color: 'orange', builtin: true },
  { id: 'cat-ideas', name: 'Project Ideas', icon: 'lightbulb-on', color: 'yellow', builtin: true },
  { id: 'cat-shopping', name: 'Shopping', icon: 'cart', color: 'mint', builtin: true },
  { id: 'cat-study', name: 'Study', icon: 'book-open-variant', color: 'violet', builtin: true },
];

export interface DataState {
  hydrated: boolean;
  notes: Note[];
  categories: Category[];
  tasks: Task[];
  reminders: Reminder[];
  shareLog: ShareEntry[];
  lastSyncAt: number | null;

  createNote: (partial?: Partial<Note>) => Note;
  updateNote: (id: string, patch: Partial<Note>) => void;
  trashNote: (id: string) => void;
  restoreNote: (id: string) => void;
  deleteNoteForever: (id: string) => Note | undefined;
  emptyTrash: () => Note[];
  purgeExpired: (days: number) => Note[];
  duplicateNote: (id: string) => Note | null;
  togglePin: (id: string) => void;

  addCategory: (c: Omit<Category, 'id'>) => Category;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  addTask: (partial?: Partial<Task>) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => Task | undefined;
  restoreTask: (task: Task) => void;
  clearCompletedTasks: () => void;

  addReminder: (partial?: Partial<Reminder>) => Reminder;
  updateReminder: (id: string, patch: Partial<Reminder>) => void;
  deleteReminder: (id: string) => Reminder | undefined;

  logShare: (noteId: string, channel: ShareEntry['channel']) => void;
  markSynced: (at: number) => void;
  replaceAll: (snap: Pick<Snapshot, 'notes' | 'categories' | 'tasks' | 'reminders' | 'shareLog'>) => void;
  resetAll: () => void;
}

const now = () => Date.now();

export const useData = create<DataState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      notes: [],
      categories: DEFAULT_CATEGORIES,
      tasks: [],
      reminders: [],
      shareLog: [],
      lastSyncAt: null,

      createNote: (partial = {}) => {
        const t = now();
        const note: Note = {
          id: uid(),
          title: '',
          body: '',
          kind: 'note',
          categoryId: null,
          color: 'none',
          pinned: false,
          locked: false,
          tags: [],
          attachments: [],
          createdAt: t,
          updatedAt: t,
          deletedAt: null,
          sharedAt: null,
          dirty: true,
          ...partial,
        };
        set((s) => ({ notes: [note, ...s.notes] }));
        return note;
      },
      updateNote: (id, patch) =>
        set((s) => ({
          notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: now(), dirty: true } : n)),
        })),
      trashNote: (id) =>
        set((s) => ({
          notes: s.notes.map((n) => (n.id === id ? { ...n, deletedAt: now(), pinned: false, dirty: true } : n)),
        })),
      restoreNote: (id) =>
        set((s) => ({
          notes: s.notes.map((n) => (n.id === id ? { ...n, deletedAt: null, updatedAt: now(), dirty: true } : n)),
        })),
      deleteNoteForever: (id) => {
        const found = get().notes.find((n) => n.id === id);
        set((s) => ({
          notes: s.notes.filter((n) => n.id !== id),
          reminders: s.reminders.map((r) => (r.noteId === id ? { ...r, noteId: null } : r)),
        }));
        return found;
      },
      emptyTrash: () => {
        const gone = get().notes.filter((n) => n.deletedAt !== null);
        set((s) => ({ notes: s.notes.filter((n) => n.deletedAt === null) }));
        return gone;
      },
      purgeExpired: (days) => {
        const limit = now() - days * 86400000;
        const gone = get().notes.filter((n) => n.deletedAt !== null && n.deletedAt < limit);
        if (gone.length) {
          const ids = new Set(gone.map((n) => n.id));
          set((s) => ({ notes: s.notes.filter((n) => !ids.has(n.id)) }));
        }
        return gone;
      },
      duplicateNote: (id) => {
        const src = get().notes.find((n) => n.id === id);
        if (!src) return null;
        const t = now();
        const copy: Note = {
          ...src,
          id: uid(),
          title: src.title ? `${src.title} (copy)` : '',
          pinned: false,
          sharedAt: null,
          attachments: src.attachments.map((a) => ({ ...a, id: uid() })),
          createdAt: t,
          updatedAt: t,
          dirty: true,
        };
        set((s) => ({ notes: [copy, ...s.notes] }));
        return copy;
      },
      togglePin: (id) =>
        set((s) => ({
          notes: s.notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned, dirty: true } : n)),
        })),

      addCategory: (c) => {
        const cat: Category = { id: uid(), updatedAt: now(), ...c };
        set((s) => ({ categories: [...s.categories, cat] }));
        return cat;
      },
      updateCategory: (id, patch) =>
        set((s) => ({ categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: now() } : c)) })),
      deleteCategory: (id) =>
        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
          notes: s.notes.map((n) => (n.categoryId === id ? { ...n, categoryId: null, dirty: true } : n)),
          tasks: s.tasks.map((t) => (t.categoryId === id ? { ...t, categoryId: null, dirty: true } : t)),
        })),

      addTask: (partial = {}) => {
        const t = now();
        const task: Task = {
          id: uid(),
          title: '',
          notes: '',
          done: false,
          doneAt: null,
          dueAt: null,
          priority: 'medium',
          categoryId: null,
          subtasks: [],
          createdAt: t,
          updatedAt: t,
          dirty: true,
          ...partial,
        };
        set((s) => ({ tasks: [task, ...s.tasks] }));
        return task;
      },
      updateTask: (id, patch) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: now(), dirty: true } : t)),
        })),
      toggleTask: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id
              ? { ...t, done: !t.done, doneAt: !t.done ? now() : null, updatedAt: now(), dirty: true }
              : t,
          ),
        })),
      deleteTask: (id) => {
        const found = get().tasks.find((t) => t.id === id);
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
        return found;
      },
      restoreTask: (task) => set((s) => ({ tasks: [task, ...s.tasks.filter((t) => t.id !== task.id)] })),
      clearCompletedTasks: () => set((s) => ({ tasks: s.tasks.filter((t) => !t.done) })),

      addReminder: (partial = {}) => {
        const r: Reminder = {
          id: uid(),
          title: '',
          notes: '',
          at: now() + 3600000,
          repeat: 'none',
          noteId: null,
          done: false,
          notificationId: null,
          createdAt: now(),
          updatedAt: now(),
          ...partial,
        };
        set((s) => ({ reminders: [r, ...s.reminders] }));
        return r;
      },
      updateReminder: (id, patch) =>
        set((s) => {
          // Re-scheduling a device notification must not count as an edit (it would ping-pong between devices).
          const edit = Object.keys(patch).some((k) => k !== 'notificationId');
          return {
            reminders: s.reminders.map((r) => (r.id === id ? { ...r, ...patch, ...(edit ? { updatedAt: now() } : {}) } : r)),
          };
        }),
      deleteReminder: (id) => {
        const found = get().reminders.find((r) => r.id === id);
        set((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) }));
        return found;
      },

      logShare: (noteId, channel) =>
        set((s) => ({
          shareLog: [{ id: uid(), noteId, channel, at: now() }, ...s.shareLog].slice(0, 200),
          notes: s.notes.map((n) => (n.id === noteId ? { ...n, sharedAt: now(), dirty: true } : n)),
        })),
      markSynced: (at) =>
        set((s) => ({
          lastSyncAt: at,
          notes: s.notes.map((n) => (n.dirty ? { ...n, dirty: false } : n)),
          tasks: s.tasks.map((t) => (t.dirty ? { ...t, dirty: false } : t)),
        })),
      replaceAll: (snap) =>
        set({
          notes: snap.notes,
          categories: snap.categories.length ? snap.categories : DEFAULT_CATEGORIES,
          tasks: snap.tasks,
          reminders: snap.reminders,
          shareLog: snap.shareLog ?? [],
        }),
      resetAll: () =>
        set({
          notes: [],
          categories: DEFAULT_CATEGORIES,
          tasks: [],
          reminders: [],
          shareLog: [],
          lastSyncAt: null,
        }),
    }),
    {
      name: 'nivora.data.v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        notes: s.notes,
        categories: s.categories,
        tasks: s.tasks,
        reminders: s.reminders,
        shareLog: s.shareLog,
        lastSyncAt: s.lastSyncAt,
      }),
      onRehydrateStorage: () => () => {
        useData.setState({ hydrated: true });
      },
    },
  ),
);

export function pendingChanges(): number {
  const s = useData.getState();
  return s.notes.filter((n) => n.dirty).length + s.tasks.filter((t) => t.dirty).length;
}

export function currentSnapshot(): Snapshot {
  const s = useData.getState();
  return {
    version: 1,
    app: 'nivora-notes',
    exportedAt: Date.now(),
    notes: s.notes,
    categories: s.categories,
    tasks: s.tasks,
    reminders: s.reminders,
    shareLog: s.shareLog,
  };
}
