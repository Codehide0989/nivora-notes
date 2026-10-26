import type { Snapshot } from '@/types';

export type SyncStep = { fraction: number; label: string };

/**
 * A sync target. Simple targets only implement `push` (the whole snapshot is handed over).
 * Two-way targets (like the encrypted cloud) implement `sync`, which pulls, merges and pushes by itself.
 */
export interface SyncAdapter {
  name: string;
  requiresNetwork: boolean;
  push: (snapshot: Snapshot) => Promise<void>;
  sync?: (report: (s: SyncStep) => void) => Promise<{ pushed: number; pulled: number }>;
}

export type SyncFailure = 'offline' | 'failed' | 'auth';
export class SyncError extends Error {
  code: SyncFailure;
  constructor(code: SyncFailure, message: string) {
    super(message);
    this.code = code;
  }
}
