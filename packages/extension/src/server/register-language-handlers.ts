import {
  CompletionItem,
  CompletionItemKind,
  MarkupKind,
  type CompletionParams,
  type Connection,
  type DefinitionParams,
  type Hover,
  type HoverParams,
  type ImplementationParams,
  type Location,
  type Position,
  type PrepareRenameParams,
  type Range,
  type RenameParams,
  type SignatureHelp,
  type SignatureHelpParams,
  type TextEdit,
  type WorkspaceEdit
} from 'vscode-languageserver/node';
import type { InternalSignatureDoc, SymbolInfo } from '@lsp/compiler';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { ResolvedContext } from './server-runtime';

type WordToken = { word: string; start: number; end: number };

type SymbolQuery = {
  scope: unknown;
  filePath: string;
};

type RegisterLanguageHandlersDeps = {
  connection: Connection;
  documents: Map<string, TextDocument>;
  keywords: string[];
  types: string[];
  snippets: Array<{ label: string; snippet: string; detail?: string }>;
  listaMethods: unknown[];
  listaProperties: Array<{ name: string }>;
  cursorMethods: string[];
  cursorProperties: string[];
  toFsPath(uri: string): string;
  toFileUri(filePath: string): string;
  findContextForFile(filePath: string): ResolvedContext | null;
  getLinePrefix(doc: TextDocument, position: Position): string;
  getWordAtPosition(doc: TextDocument, position: Position): WordToken | null;
  isInsideStringLiteral(line: string, position: number): boolean;
  getSymbolsForContext(context: ResolvedContext): Promise<SymbolInfo[]>;
  getSymbolsForFallbackDocument(doc: TextDocument): Promise<SymbolInfo[]>;
  completionItem(kind: CompletionItemKind | number, label: string, insertText?: string): CompletionItem;
  snippetItem(label: string, snippet: string, detail?: string): CompletionItem;
  listaMethodCompletionItem(method: unknown): CompletionItem;
  listaPropertyCompletionItem(property: { name: string }): CompletionItem;
  getCompilerSystemForFile(filePath: string, context: ResolvedContext | null): unknown;
  ensureInternalSignatures(system: unknown): Promise<InternalSignatureDoc[]>;
  isInternalVariableDoc(sig: InternalSignatureDoc): boolean;
  isConstInternalDoc(sig: InternalSignatureDoc): boolean;
  normalizeNameForKey(name: string): string;
  sendLog(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: { id?: string }, filePath?: string | null): void;
  findCustomSymbolForHover(doc: TextDocument, context: ResolvedContext | null, wordKey: string, requestId: string): Promise<SymbolInfo | null>;
  buildCustomHoverCacheKey(input: { contextKey: string | null; fallbackPath: string | null; wordKey: string; symbolFingerprint: string }): string;
  buildCustomSymbolFingerprint(symbol: SymbolInfo): string;
  getHoverFromCacheOrBuild(cacheKey: string, builder: () => string, requestId: string, kind: 'custom' | 'official'): string;
  formatCustomSymbolHover(symbol: SymbolInfo): string;
  ensureInternalIndex(system: unknown): Promise<{ byKey: Map<string, InternalSignatureDoc>; byName: Map<string, InternalSignatureDoc[]> }>;
  lookupOfficialHoverSignatures(index: { byKey: Map<string, InternalSignatureDoc>; byName: Map<string, InternalSignatureDoc[]> }, system: unknown, name: string): InternalSignatureDoc[];
  buildOfficialHoverCacheKey(input: { system: unknown; contextKey: string | null; wordKey: string; docVersionFingerprint: string }): string;
  buildOfficialDocVersionFingerprint(signatures: readonly InternalSignatureDoc[]): string;
  formatInternalSignatureHover(sig: InternalSignatureDoc, getInternalOriginPrefix: (sig: InternalSignatureDoc, requestId?: string) => string): string;
  getInternalOriginPrefix(sig: InternalSignatureDoc, requestId?: string): string;
  getSymbolQueryScopeForDocument(doc: TextDocument): Promise<SymbolQuery>;
  resolveSymbolAtPosition(input: { scope: unknown; filePath: string; position: Position }): { definitionLocations: Array<{ sourcePath: string; range: Range }> } | null;
  prepareRename(input: { scope: unknown; filePath: string; position: Position }): { range: Range } | null;
  renameSymbol(input: { scope: unknown; filePath: string; position: Position; newName: string }): { ok: boolean; edits?: Map<string, Array<{ range: Range; newText: string }>> };
  formatParamLabel(param: { name: string; dataType?: string }): string;
  getSignatureCallContext(doc: TextDocument, position: Position): { name: string; activeParameter: number } | null;
  shouldServeCustomFromCommittedCache(cache: unknown): boolean;
  getContextCache(contextKey: string): unknown;
};

export function registerLanguageHandlers(deps: RegisterLanguageHandlersDeps): void
{
  const {
    connection,
    documents,
    keywords,
    types,
    snippets,
    listaMethods,
    listaProperties,
    cursorMethods,
    cursorProperties,
    toFsPath,
    toFileUri,
    findContextForFile,
    getLinePrefix,
    getWordAtPosition,
    isInsideStringLiteral,
    getSymbolsForContext,
    getSymbolsForFallbackDocument,
    completionItem,
    snippetItem,
    listaMethodCompletionItem,
    listaPropertyCompletionItem,
    getCompilerSystemForFile,
    ensureInternalSignatures,
    isInternalVariableDoc,
    isConstInternalDoc,
    normalizeNameForKey,
    sendLog,
    findCustomSymbolForHover,
    buildCustomHoverCacheKey,
    buildCustomSymbolFingerprint,
    getHoverFromCacheOrBuild,
    formatCustomSymbolHover,
    ensureInternalIndex,
    lookupOfficialHoverSignatures,
    buildOfficialHoverCacheKey,
    buildOfficialDocVersionFingerprint,
    formatInternalSignatureHover,
    getInternalOriginPrefix,
    getSymbolQueryScopeForDocument,
    resolveSymbolAtPosition,
    prepareRename,
    renameSymbol,
    formatParamLabel,
    getSignatureCallContext,
    shouldServeCustomFromCommittedCache,
    getContextCache
  } = deps;

  connection.onCompletion(async (params: CompletionParams) =>
  {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return [];
    const filePath = toFsPath(doc.uri);
    const context = findContextForFile(filePath);

    const linePrefix = getLinePrefix(doc, params.position);
    const memberMatch = /([A-Za-z_][\w]*)(?:\[[^\]]*\])?\.([A-Za-z_]*)$/.exec(linePrefix);
    const symbols = context ? await getSymbolsForContext(context) : await getSymbolsForFallbackDocument(doc);

    if (memberMatch)
    {
      const owner = memberMatch[1];
      const memberPrefix = memberMatch[2].toLowerCase();
      const ownerSym = symbols.find((s) => s.name.toLowerCase() === owner.toLowerCase());
      if (ownerSym?.typeName === 'Lista')
      {
        const fields = ownerSym.listFields ?? [];
        const fieldItems = fields
          .filter((f) => f.toLowerCase().startsWith(memberPrefix))
          .map((f) => completionItem(CompletionItemKind.Property, f));

        const propertyItems = listaProperties
          .filter((p) => p.name.toLowerCase().startsWith(memberPrefix))
          .map((p) => listaPropertyCompletionItem(p));

        const methodItems = listaMethods
          .filter((m): m is { name: string } => typeof m === 'object' && m !== null && 'name' in m)
          .filter((m) => m.name.toLowerCase().startsWith(memberPrefix))
          .map((m) => listaMethodCompletionItem(m));

        if ('sql'.startsWith(memberPrefix) && !methodItems.some((it) => it.label.toLowerCase() === 'sql'))
        {
          methodItems.push(completionItem(CompletionItemKind.Method, 'SQL'));
        }

        return [...fieldItems, ...propertyItems, ...methodItems];
      }
      if (ownerSym?.typeName === 'Cursor')
      {
        const fields = ownerSym.cursorFields ?? [];
        const fieldItems = fields
          .filter((f) => f.toLowerCase().startsWith(memberPrefix))
          .map((f) => completionItem(10, f));

        const propertyItems = cursorProperties
          .filter((p) => p.toLowerCase().startsWith(memberPrefix))
          .filter((p) => p.toLowerCase() !== 'sql')
          .map((p) => completionItem(10, p));

        const methodItems = cursorMethods
          .filter((m) => m.toLowerCase().startsWith(memberPrefix))
          .map((m) => completionItem(2, m));

        if ('sql'.startsWith(memberPrefix) && !methodItems.some((it) => it.label.toLowerCase() === 'sql'))
        {
          methodItems.push(completionItem(2, 'SQL'));
        }

        return [...fieldItems, ...propertyItems, ...methodItems];
      }
      if (ownerSym?.typeName === 'Tabela')
      {
        const hasIndexedOwner = /[A-Za-z_][\w]*\[[^\]]+\]\.[A-Za-z_]*$/.test(linePrefix);
        if (!hasIndexedOwner) return [];
        const fields = (ownerSym.tableColumns ?? []).map((column) => column.name);
        const uniqueFields = [...new Set(fields.map((field) => field.trim()).filter(Boolean))];
        return uniqueFields
          .filter((field) => field.toLowerCase().startsWith(memberPrefix))
          .map((field) => completionItem(CompletionItemKind.Property, field));
      }
    }

    const pragmaPrefixMatch = /(?:^|[^A-Za-z0-9_])(@?lsp-sql-[A-Za-z-]*)$/i.exec(linePrefix);
    const pragmaPrefix = pragmaPrefixMatch?.[1]?.replace(/^@/, '') ?? '';
    if (pragmaPrefix)
    {
      return snippets
        .filter((snippet) => snippet.snippet.includes('@lsp-sql-'))
        .filter((snippet) => snippet.snippet.toLowerCase().includes(`@${pragmaPrefix.toLowerCase()}`))
        .map((snippet) => snippetItem(snippet.label, snippet.snippet, snippet.detail));
    }

    const prefixMatch = /([A-Za-z_][\w]*)$/.exec(linePrefix);
    const prefix = prefixMatch ? prefixMatch[1] : '';
    const system = getCompilerSystemForFile(filePath, context);
    const internal = await ensureInternalSignatures(system);
    const internalItems = (prefix ? internal.filter((s) => s.name.toLowerCase().startsWith(prefix.toLowerCase())) : internal).map(
      (sig) =>
      {
        if (isInternalVariableDoc(sig))
        {
          const kind = isConstInternalDoc(sig) ? CompletionItemKind.Constant : CompletionItemKind.Variable;
          return completionItem(kind, sig.name, sig.name);
        }
        return completionItem(CompletionItemKind.Function, sig.name, `${sig.name}(`);
      }
    );

    const symbolsByName = new Map<string, SymbolInfo>();
    for (const s of symbols)
    {
      const key = s.nameNormalized ?? s.name.toLowerCase();
      const prev = symbolsByName.get(key);
      if (!prev)
      {
        symbolsByName.set(key, s);
        continue;
      }
      const prevScore = (prev.implemented ? 2 : 0) + (prev.params && prev.params.length > 0 ? 1 : 0);
      const nextScore = (s.implemented ? 2 : 0) + (s.params && s.params.length > 0 ? 1 : 0);
      if (nextScore > prevScore) symbolsByName.set(key, s);
    }

    const symbolItems = [...symbolsByName.values()]
      .filter((s) => s.name.toLowerCase().startsWith(prefix.toLowerCase()))
      .map((sym) => completionItem(sym.kind === 'function' ? 3 : 6, sym.name, sym.kind === 'function' ? `${sym.name}(` : sym.name));
    const keywordItems = keywords
      .filter((k) => k.toLowerCase().startsWith(prefix.toLowerCase()))
      .map((k) => completionItem(14, k));
    const typeItems = types
      .filter((t) => t.toLowerCase().startsWith(prefix.toLowerCase()))
      .map((t) => completionItem(25, t));
    const snippetItems = snippets
      .filter((snippet) => prefix.length === 0 || snippet.label.toLowerCase().startsWith(prefix.toLowerCase()) || snippet.snippet.toLowerCase().startsWith(prefix.toLowerCase()))
      .map((s) => snippetItem(s.label, s.snippet, s.detail));

    return [...internalItems, ...symbolItems, ...keywordItems, ...typeItems, ...snippetItems];
  });

  connection.onHover(async (params: HoverParams): Promise<Hover | null> =>
  {
    const requestId = `hover-${Date.now()}-${params.position.line}:${params.position.character}`;
    try
    {
      sendLog('info', 'hover: recebido', { id: requestId });
      const doc = documents.get(params.textDocument.uri);
      if (!doc) return null;
      const filePath = toFsPath(doc.uri);
      const context = findContextForFile(filePath);
      const linePrefix = getLinePrefix(doc, params.position);
      if (isInsideStringLiteral(linePrefix, params.position.character)) return null;
      const token = getWordAtPosition(doc, params.position);
      if (!token) return null;
      const wordKey = normalizeNameForKey(token.word);
      const system = getCompilerSystemForFile(filePath, context);
      sendLog('info', `hover: word=${token.word} system=${String(system)}`, { id: requestId });

      const customSymbol = await findCustomSymbolForHover(doc, context, wordKey, requestId);
      if (customSymbol)
      {
        const customCacheKey = buildCustomHoverCacheKey({
          contextKey: context?.key ?? null,
          fallbackPath: context ? null : filePath,
          wordKey,
          symbolFingerprint: buildCustomSymbolFingerprint(customSymbol)
        });
        const markdown = getHoverFromCacheOrBuild(customCacheKey, () => formatCustomSymbolHover(customSymbol), requestId, 'custom');
        return {
          contents: { kind: MarkupKind.Markdown, value: markdown },
          range: {
            start: { line: params.position.line, character: token.start },
            end: { line: params.position.line, character: token.end }
          }
        };
      }

      const index = await ensureInternalIndex(system);
      const signatures = lookupOfficialHoverSignatures(index, system, wordKey);
      if (signatures.length === 0) return null;
      const officialCacheKey = buildOfficialHoverCacheKey({
        system,
        contextKey: context?.key ?? null,
        wordKey,
        docVersionFingerprint: buildOfficialDocVersionFingerprint(signatures)
      });
      const markdown = getHoverFromCacheOrBuild(
        officialCacheKey,
        () => signatures.map((sig) => formatInternalSignatureHover(sig, getInternalOriginPrefix)).join('\n\n---\n\n'),
        requestId,
        'official'
      );
      return {
        contents: { kind: MarkupKind.Markdown, value: markdown },
        range: {
          start: { line: params.position.line, character: token.start },
          end: { line: params.position.line, character: token.end }
        }
      };
    } catch (error)
    {
      sendLog('error', `hover: erro ${String(error)}`, { id: requestId });
      return null;
    }
  });

  connection.onDefinition(async (params: DefinitionParams): Promise<Location[] | null> =>
  {
    try
    {
      const doc = documents.get(params.textDocument.uri);
      if (!doc) return null;
      const query = await getSymbolQueryScopeForDocument(doc);
      const resolved = resolveSymbolAtPosition({
        scope: query.scope,
        filePath: query.filePath,
        position: params.position
      });
      if (!resolved || resolved.definitionLocations.length === 0) return null;
      return resolved.definitionLocations.map((def) => ({
        uri: toFileUri(def.sourcePath),
        range: def.range
      }));
    } catch (error)
    {
      sendLog('error', `definition: erro ${String(error)}`);
      return null;
    }
  });

  connection.onPrepareRename(async (params: PrepareRenameParams): Promise<Range | null> =>
  {
    try
    {
      const doc = documents.get(params.textDocument.uri);
      if (!doc) return null;
      const query = await getSymbolQueryScopeForDocument(doc);
      const result = prepareRename({
        scope: query.scope,
        filePath: query.filePath,
        position: params.position
      });
      return result?.range ?? null;
    } catch (error)
    {
      sendLog('error', `prepareRename: erro ${String(error)}`);
      return null;
    }
  });

  connection.onRenameRequest(async (params: RenameParams): Promise<WorkspaceEdit | null> =>
  {
    try
    {
      const doc = documents.get(params.textDocument.uri);
      if (!doc) return null;
      const query = await getSymbolQueryScopeForDocument(doc);
      const result = renameSymbol({
        scope: query.scope,
        filePath: query.filePath,
        position: params.position,
        newName: params.newName
      });
      if (!result.ok || !result.edits) return null;
      const changes: WorkspaceEdit['changes'] = {};
      for (const [filePath, edits] of result.edits.entries())
      {
        const uri = toFileUri(filePath);
        const lspEdits: TextEdit[] = edits.map((edit) => ({ range: edit.range, newText: edit.newText }));
        changes[uri] = lspEdits;
      }
      return { changes };
    } catch (error)
    {
      sendLog('error', `rename: erro ${String(error)}`);
      return null;
    }
  });

  connection.onImplementation(async (params: ImplementationParams): Promise<Location[] | null> =>
  {
    try
    {
      sendLog('info', 'implementation: recebido');
      const doc = documents.get(params.textDocument.uri);
      if (!doc) return null;
      const filePath = toFsPath(doc.uri);
      const context = findContextForFile(filePath);
      const token = getWordAtPosition(doc, params.position);
      if (!token) return null;
      const symbols = context ? await getSymbolsForContext(context) : await getSymbolsForFallbackDocument(doc);
      const matches = symbols.filter((s) => s.kind === 'function' && s.name.toLowerCase() === token.word.toLowerCase() && s.range && s.implemented);
      if (matches.length === 0) return null;
      return matches.map((symbol) => ({
        uri: toFileUri(symbol.sourcePath),
        range: {
          start: symbol.range!.start,
          end: symbol.range!.start
        }
      }));
    } catch (error)
    {
      sendLog('error', `implementation: erro ${String(error)}`);
      return null;
    }
  });

  connection.onSignatureHelp(async (params: SignatureHelpParams): Promise<SignatureHelp | null> =>
  {
    const requestId = `sig-${Date.now()}-${params.position.line}:${params.position.character}`;
    try
    {
      sendLog('info', 'signatureHelp: recebido', { id: requestId });
      const doc = documents.get(params.textDocument.uri);
      if (!doc) return null;
      const filePath = toFsPath(doc.uri);
      const context = findContextForFile(filePath);
      const callContext = getSignatureCallContext(doc, params.position);
      if (!callContext) return null;
      const name = callContext.name;
      const nameKey = normalizeNameForKey(name);
      const system = getCompilerSystemForFile(filePath, context);
      const index = await ensureInternalIndex(system);
      const internalSigs = lookupOfficialHoverSignatures(index, system, nameKey);

      let custom: SymbolInfo | undefined;
      if (internalSigs.length === 0)
      {
        let symbols: SymbolInfo[] = [];
        if (context)
        {
          symbols = await getSymbolsForContext(context);
          if (!shouldServeCustomFromCommittedCache(getContextCache(context.key)))
          {
            sendLog('info', 'signatureHelp: custom indisponivel (aguardando commit)', { id: requestId });
          }
        } else
        {
          symbols = await getSymbolsForFallbackDocument(doc);
        }
        custom = symbols.find((s) => s.kind === 'function' && normalizeNameForKey(s.name) === nameKey && s.params);
      }

      const help: SignatureHelp = { signatures: [], activeSignature: 0, activeParameter: 0 };
      if (internalSigs.length > 0)
      {
        for (const sig of internalSigs.filter((entry) => !isInternalVariableDoc(entry)))
        {
          const signature = sig as InternalSignatureDoc & {
            params?: Array<{ name: string; dataType?: string; documentation?: string }>;
            isReturnValue?: boolean;
            dataType?: string;
          };
          const prefix = getInternalOriginPrefix(signature, requestId);
          const params = signature.params ?? [];
          const returnType = signature.isReturnValue && signature.dataType ? `: ${signature.dataType}` : '';
          help.signatures.push({
            label: `${prefix}${signature.name}(${params.map(formatParamLabel).join(', ')})${returnType}`,
            documentation: signature.documentation ? { kind: MarkupKind.Markdown, value: signature.documentation } : undefined,
            parameters: params.map((p) => ({
              label: formatParamLabel(p),
              documentation: p.documentation ? { kind: MarkupKind.Markdown, value: p.documentation } : undefined
            }))
          });
        }
      } else if (custom?.params)
      {
        help.signatures.push({
          label: `[CUSTOMIZADO] ${custom.name}(${custom.params.map(formatParamLabel).join(', ')})`,
          parameters: custom.params.map((p) => ({ label: formatParamLabel(p) }))
        });
      }

      if (help.signatures.length === 0) return null;
      const paramCount = help.signatures[0]?.parameters?.length ?? 0;
      help.activeParameter = paramCount > 0 ? Math.min(Math.max(0, callContext.activeParameter), paramCount - 1) : 0;
      return help;
    } catch (error)
    {
      sendLog('error', `signatureHelp: erro ${String(error)}`, { id: requestId });
      return null;
    }
  });
}
