import path from 'node:path';
import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createFallbackValidationService } from '../../../src/server/fallback/fallback-validation-service';
import type { ResolvedContext } from '../../../src/server/server-runtime';

const { compileSingleFileMock } = vi.hoisted(() => ({
  compileSingleFileMock: vi.fn()
}));

vi.mock('@lsp/compiler', async () => {
  const actual = await vi.importActual<typeof import('@lsp/compiler')>('@lsp/compiler');
  return {
    ...actual,
    compileSingleFile: compileSingleFileMock
  };
});

function createDocument(filePath: string, version = 1, text = `Definir Numero nNum;
nNum = 1;
`): TextDocument {
  return TextDocument.create(`file://${filePath}`, 'lsp', version, text);
}

function createContext(rootDir: string): ResolvedContext {
  return {
    name: 'HR',
    key: 'HR::ctx',
    rootDir,
    workspaceUri: `file://${rootDir}`,
    filePattern: 'HR*.lspt',
    includeSubdirectories: false,
    system: 'HCM',
    diagnosticsIgnoreIds: []
  };
}

describe('fallback validation service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    compileSingleFileMock.mockReset();
    compileSingleFileMock.mockResolvedValue({
      diagnostics: [],
      symbols: [],
      files: [],
      contextId: '__singlefile__'
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('revalidates only documents that are still outside contexts', async () => {
    const rootDir = path.join(os.tmpdir(), 'lsp-fallback-service-context');
    const ctx = createContext(rootDir);
    const contextual = createDocument(path.join(rootDir, 'HR850.lspt'));
    const fallback = createDocument(path.join(rootDir, 'OUTSIDE.lspt'));
    const documents = new Map([
      [contextual.uri, contextual],
      [fallback.uri, fallback]
    ]);
    const refreshMock = vi.fn();

    const service = createFallbackValidationService({
      documents,
      getResolvedContexts: () => [ctx],
      toFsPath: (uri) => uri.replace('file://', ''),
      getCompilerSystemForFile: () => 'HCM',
      getObservabilitySettingsForFile: () => ({}),
      observability: { span: () => () => {} },
      sendDebugLog: () => {},
      resolveWorkspaceUriForFile: () => 'file:///workspace',
      schedulePullDiagnosticsRefresh: refreshMock
    });

    service.revalidateOpenFallbackDocs();
    await vi.runAllTimersAsync();

    expect(compileSingleFileMock).toHaveBeenCalledTimes(1);
    expect(compileSingleFileMock.mock.calls[0][0]).toMatchObject({
      filePath: path.join(rootDir, 'OUTSIDE.lspt'),
      system: 'HCM'
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });


  it('skips stale fallback validation when the same URI is reopened with newer content before the timer fires', async () => {
    const rootDir = path.join(os.tmpdir(), 'lsp-fallback-service-stale-reopen');
    const filePath = path.join(rootDir, 'OUTSIDE.lspt');
    const original = createDocument(filePath, 1, `Definir Numero a;
a = 1;
`);
    const reopened = createDocument(filePath, 2, `Definir Numero b;
b = 2;
`);
    const documents = new Map([[original.uri, original]]);
    const refreshMock = vi.fn();

    const service = createFallbackValidationService({
      documents,
      getResolvedContexts: () => [],
      toFsPath: (uri) => uri.replace('file://', ''),
      getCompilerSystemForFile: () => 'HCM',
      getObservabilitySettingsForFile: () => ({}),
      observability: { span: () => () => {} },
      sendDebugLog: () => {},
      resolveWorkspaceUriForFile: () => 'file:///workspace',
      schedulePullDiagnosticsRefresh: refreshMock
    });

    service.scheduleFallbackValidation(original, 250);
    documents.set(reopened.uri, reopened);
    await vi.advanceTimersByTimeAsync(300);

    expect(compileSingleFileMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('disposes pending validation for a closed fallback document', async () => {
    const rootDir = path.join(os.tmpdir(), 'lsp-fallback-service-dispose');
    const fallback = createDocument(path.join(rootDir, 'OUTSIDE.lspt'));
    const documents = new Map([[fallback.uri, fallback]]);
    const refreshMock = vi.fn();

    const service = createFallbackValidationService({
      documents,
      getResolvedContexts: () => [],
      toFsPath: (uri) => uri.replace('file://', ''),
      getCompilerSystemForFile: () => 'HCM',
      getObservabilitySettingsForFile: () => ({}),
      observability: { span: () => () => {} },
      sendDebugLog: () => {},
      resolveWorkspaceUriForFile: () => 'file:///workspace',
      schedulePullDiagnosticsRefresh: refreshMock
    });

    service.scheduleFallbackValidation(fallback, 250);
    service.disposeDocument(fallback.uri);
    await vi.advanceTimersByTimeAsync(300);

    expect(compileSingleFileMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
