import { hashText, normalizePathKey } from '../runtime/path-utils';

export type DocumentSnapshot = {
  uri: string;
  filePath: string;
  contextId: string;
  version: number;
  text: string;
  hash: string;
};

export function createSnapshotStore() {
  const byUri = new Map<string, DocumentSnapshot>();

  function upsert(input: {
    uri: string;
    filePath: string;
    contextId: string;
    version: number;
    text: string;
  }): DocumentSnapshot {
    const snapshot: DocumentSnapshot = {
      uri: input.uri,
      filePath: input.filePath,
      contextId: input.contextId,
      version: input.version,
      text: input.text,
      hash: hashText(input.text)
    };
    byUri.set(input.uri, snapshot);
    return snapshot;
  }

  function remove(uri: string): void {
    byUri.delete(uri);
  }

  function get(uri: string): DocumentSnapshot | undefined {
    return byUri.get(uri);
  }

  function listByContext(contextId: string): DocumentSnapshot[] {
    const list: DocumentSnapshot[] = [];
    for (const snapshot of byUri.values()) {
      if (snapshot.contextId === contextId) {
        list.push(snapshot);
      }
    }
    return list;
  }

  function getByFilePath(filePath: string): DocumentSnapshot | undefined {
    const key = normalizePathKey(filePath);
    for (const snapshot of byUri.values()) {
      if (normalizePathKey(snapshot.filePath) === key) return snapshot;
    }
    return undefined;
  }

  function listAll(): DocumentSnapshot[] {
    return [...byUri.values()];
  }

  function clear(): void {
    byUri.clear();
  }

  return {
    upsert,
    remove,
    get,
    listByContext,
    listAll,
    getByFilePath,
    clear
  };
}
