export type DocHashHistoryTracker = {
  update: (uri: string, text: string) => { hash: string; undoLike: boolean };
  delete: (uri: string) => void;
};

type Entry = {
  currentHash: string;
  previousHash: string | null;
  updatedAtMs: number;
};

export function createDocHashHistoryTracker(input: {
  hashText: (text: string) => string;
  undoLikeWindowMs: number;
  isUndoLikeTransition: (input: {
    nextHash: string;
    previousHash: string | null;
    beforePreviousHash: string | null;
    elapsedMs: number;
    windowMs: number;
  }) => boolean;
}): DocHashHistoryTracker {
  const byUri = new Map<string, Entry>();

  function update(uri: string, text: string): { hash: string; undoLike: boolean } {
    const nextHash = input.hashText(text);
    const now = Date.now();
    const previous = byUri.get(uri);
    const undoLike = Boolean(previous) && input.isUndoLikeTransition({
      nextHash,
      previousHash: previous?.currentHash ?? null,
      beforePreviousHash: previous?.previousHash ?? null,
      elapsedMs: previous ? (now - previous.updatedAtMs) : Number.POSITIVE_INFINITY,
      windowMs: input.undoLikeWindowMs
    });
    byUri.set(uri, {
      currentHash: nextHash,
      previousHash: previous?.currentHash ?? null,
      updatedAtMs: now
    });
    return { hash: nextHash, undoLike };
  }

  return {
    update,
    delete: (uri: string) => {
      byUri.delete(uri);
    }
  };
}
