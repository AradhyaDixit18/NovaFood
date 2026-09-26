import { create } from 'zustand';

interface ConfirmRequest {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmState {
  request: (ConfirmRequest & { resolve: (ok: boolean) => void }) | null;
  ask: (req: ConfirmRequest) => Promise<boolean>;
  answer: (ok: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  request: null,
  ask: (req) =>
    new Promise<boolean>((resolve) => {
      get().request?.resolve(false);
      set({ request: { ...req, resolve } });
    }),
  answer: (ok) => {
    get().request?.resolve(ok);
    set({ request: null });
  },
}));

/** Promise-based confirmation dialog: `if (await confirm({...})) ...` */
export const confirm = (req: ConfirmRequest) => useConfirmStore.getState().ask(req);
