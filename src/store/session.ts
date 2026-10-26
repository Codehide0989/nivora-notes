import { create } from 'zustand';

interface SessionState {
  ready: boolean;
  pinSet: boolean;
  locked: boolean;
  /** Counter: while > 0 the app will not auto-lock when backgrounded (pickers, share sheets, biometrics). */
  suppressLock: number;
  setReady: (v: boolean) => void;
  setPinSet: (v: boolean) => void;
  lock: () => void;
  unlock: () => void;
  beginExternal: () => void;
  endExternal: () => void;
}

export const useSession = create<SessionState>((set) => ({
  ready: false,
  pinSet: false,
  locked: false,
  suppressLock: 0,
  setReady: (ready) => set({ ready }),
  setPinSet: (pinSet) => set({ pinSet }),
  lock: () => set({ locked: true }),
  unlock: () => set({ locked: false }),
  beginExternal: () => set((s) => ({ suppressLock: s.suppressLock + 1 })),
  endExternal: () => set((s) => ({ suppressLock: Math.max(0, s.suppressLock - 1) })),
}));

/** Run something that leaves the app (system picker, share sheet) without triggering auto-lock. */
export async function external<T>(fn: () => Promise<T>): Promise<T> {
  const { beginExternal, endExternal } = useSession.getState();
  beginExternal();
  try {
    return await fn();
  } finally {
    setTimeout(endExternal, 800);
  }
}
