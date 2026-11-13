/** What a Server Action that the screen updates optimistically returns: it worked, or why it didn't. */
export type ActionResult = { ok: true } | { ok: false; error: string };

export const ok: ActionResult = { ok: true };
export const fail = (error: string): ActionResult => ({ ok: false, error });
