import { compileSingleFile, type CompileResult, type LspSystem } from '@lsp/compiler';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { ResolvedContext } from '../server-runtime';
import { isFallbackFile } from './fallback-server';

type FallbackCacheEntry = {
  version: number;
  system: LspSystem;
  includeSemantics: boolean;
  result: CompileResult;
};

type FallbackValidationServiceInput = {
  documents: Map<string, TextDocument>;
  getResolvedContexts(): ResolvedContext[];
  toFsPath(uri: string): string;
  getCompilerSystemForFile(filePath: string, context: ResolvedContext | null): LspSystem;
  getObservabilitySettingsForFile(filePath: string | null): unknown;
  observability: {
    span(settings: unknown, name: string, payload: { id: string }): () => void;
  };
  sendDebugLog(filePath: string | null, message: string): void;
  resolveWorkspaceUriForFile(filePath: string): string;
  schedulePullDiagnosticsRefresh(reason: string, workspaceUri?: string, delayMs?: number): void;
};

export function createFallbackValidationService(input: FallbackValidationServiceInput)
{
  const fallbackCache = new Map<string, FallbackCacheEntry>();
  const fallbackTimers = new Map<string, NodeJS.Timeout>();

  function isFallbackDocument(doc: TextDocument): boolean
  {
    if (doc.languageId !== 'lsp') return false;
    const filePath = input.toFsPath(doc.uri);
    const fallback = isFallbackFile(filePath, input.getResolvedContexts());
    input.sendDebugLog(filePath, `fallback: file=${filePath} -> ${fallback}`);
    return fallback;
  }

  async function compileFallbackDocument(doc: TextDocument, includeSemantics = false): Promise<CompileResult>
  {
    const filePath = input.toFsPath(doc.uri);
    const system = input.getCompilerSystemForFile(filePath, null);
    const spanEnd = input.observability.span(input.getObservabilitySettingsForFile(filePath), 'fallback.compile', {
      id: `${doc.uri}-${doc.version}`
    });
    input.sendDebugLog(filePath, `fallback: compile file=${filePath} system=${system} includeSemantics=${includeSemantics}`);
    const cached = fallbackCache.get(doc.uri);
    if (
      cached &&
      cached.version === doc.version &&
      cached.system === system &&
      (cached.includeSemantics || !includeSemantics)
    )
    {
      spanEnd();
      return cached.result;
    }
    const result = await compileSingleFile({
      filePath,
      text: doc.getText(),
      system,
      includeSemantics
    });
    input.sendDebugLog(filePath, `fallback: done file=${filePath} diagnostics=${result.diagnostics.length}`);
    fallbackCache.set(doc.uri, { version: doc.version, system, includeSemantics, result });
    spanEnd();
    return result;
  }

  async function validateFallbackDocument(doc: TextDocument): Promise<void>
  {
    const current = input.documents.get(doc.uri);
    if (!current)
    {
      input.sendDebugLog(input.toFsPath(doc.uri), `fallback: skip stale validation (document closed) uri=${doc.uri}`);
      return;
    }
    if (current.version !== doc.version || current.getText() !== doc.getText())
    {
      input.sendDebugLog(input.toFsPath(doc.uri), `fallback: skip stale validation (document changed) uri=${doc.uri} scheduledVersion=${doc.version} currentVersion=${current.version}`);
      return;
    }
    await compileFallbackDocument(current);
    const filePath = input.toFsPath(current.uri);
    input.schedulePullDiagnosticsRefresh('fallbackValidation', input.resolveWorkspaceUriForFile(filePath));
  }

  function scheduleFallbackValidation(doc: TextDocument, delayMs = 200): void
  {
    const current = fallbackTimers.get(doc.uri);
    if (current) clearTimeout(current);
    const timer = setTimeout(() =>
    {
      fallbackTimers.delete(doc.uri);
      void validateFallbackDocument(doc);
    }, delayMs);
    fallbackTimers.set(doc.uri, timer);
  }

  function getOpenFallbackDocs(): TextDocument[]
  {
    const list: TextDocument[] = [];
    for (const doc of input.documents.values())
    {
      if (isFallbackDocument(doc)) list.push(doc);
    }
    return list;
  }

  function revalidateOpenFallbackDocs(): void
  {
    for (const doc of getOpenFallbackDocs())
    {
      scheduleFallbackValidation(doc, 0);
    }
  }

  function disposeDocument(uri: string): void
  {
    fallbackCache.delete(uri);
    const timer = fallbackTimers.get(uri);
    if (timer) clearTimeout(timer);
    fallbackTimers.delete(uri);
  }

  function dispose(): void
  {
    for (const timer of fallbackTimers.values())
    {
      clearTimeout(timer);
    }
    fallbackTimers.clear();
    fallbackCache.clear();
  }

  return {
    isFallbackDocument,
    compileFallbackDocument,
    scheduleFallbackValidation,
    revalidateOpenFallbackDocs,
    disposeDocument,
    reset: dispose,
    dispose
  };
}
