import path from 'node:path';
import fs from 'node:fs';
import fg from 'fast-glob';
import * as vscode from 'vscode';
import { fileBelongsToContext } from '@lsp/compiler';
import { LanguageClient, TransportKind, type LanguageClientOptions, type ServerOptions } from 'vscode-languageclient/node';
import { buildQuickFixPlans, type QuickFixEdit } from './server/language/quick-fixes';
import { buildRefactorPlans, type RefactorBlockStyle, type RefactorEdit } from './server/language/refactors';
import { mergeIgnoredCodes, normalizeDiagnosticCode, removeIgnoredCode } from './server/diagnostics/diagnostics-ignore';
import { clearIgnoredCodes, listEffectiveIgnoredCodes } from './server/diagnostics/diagnostics-ignore-commands';
import { applyQuickFixWithPrompt } from './server/language/quickfix-command-flow';
import { formatStatusBarText, normalizeFallbackSystem, resolveEffectiveFallbackSystem, type FallbackSystem } from './server/fallback/fallback-utils';
import {
  type ContextConfigAccessor,
  getEffectiveContexts,
  readContextsConfig,
  validateContexts,
  writeContextsConfig,
  type ContextConfig,
  type ContextSystem
} from './server/context/contexts-config';
import { buildContextFixActions, disableContextByName } from './server/context/contexts-fixes';

let client: LanguageClient | null = null;
type ContextTemplate = {
  label: string;
  description: string;
  rootDir: string;
  filePattern: string;
  includeSubdirectories: boolean;
  system: ContextSystem;
};

type QuickFixEditPlanPayload = {
  version: 1;
  title: string;
  uri: string;
  edits: QuickFixEdit[];
  rename?: {
    suggestedName?: string;
    requiresConfirmation?: boolean;
  };
};

type RefactorEditPlanPayload = {
  version: 1;
  title: string;
  uri: string;
  edits: RefactorEdit[];
  selection?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
};

export function activate(context: vscode.ExtensionContext) {

  const serverModule = context.asAbsolutePath(path.join('dist', 'server.js'));
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
  };

  const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{lspt,txt}');
  context.subscriptions.push(fileWatcher);

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'lsp' }],
    synchronize: {
      configurationSection: 'lsp',
      fileEvents: fileWatcher
    },

    initializationOptions: {
      vscodeVersion: vscode.version,
      globalStoragePath: context.globalStorageUri.fsPath
    }
  };

  client = new LanguageClient('lsp', 'Linguaguem de Suporte para "Linguaguem Senior de Programação"', serverOptions, clientOptions);
  const clientStart = client.start();
  context.subscriptions.push({
    dispose: () => {
      void client?.stop();
    }
  });

  const output = vscode.window.createOutputChannel('LSP');
  context.subscriptions.push(output);
  const contextConfigAccessor: ContextConfigAccessor<vscode.Uri> = {
    inspectContexts: (resource) => {
      const config = vscode.workspace.getConfiguration('lsp', resource ?? undefined);
      return config.inspect<unknown[]>('contexts');
    },
    updateContexts: async (scope, newConfig, resource) => {
      const config = vscode.workspace.getConfiguration('lsp', resource ?? undefined);
      const target = scope === 'workspace' ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
      await config.update('contexts', newConfig, target);
    }
  };
  const contextSystems: ContextSystem[] = ['HCM', 'ACESSO', 'ERP'];

  const getActiveResource = () => vscode.window.activeTextEditor?.document.uri;
  const isValidIdentifier = (value: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
  const applyQuickFixPlan = async (payload: QuickFixEditPlanPayload, finalName?: string) => {
    const uri = vscode.Uri.parse(payload.uri);
    const edit = new vscode.WorkspaceEdit();
    const replaceName = (text: string) => {
      if (!finalName) return text;
      return text.replaceAll('{{NAME}}', finalName);
    };
    const orderedEdits = payload.edits
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        if (a.item.type === 'replace' && b.item.type === 'insert') return -1;
        if (a.item.type === 'insert' && b.item.type === 'replace') return 1;
        if (a.item.type === 'replace' && b.item.type === 'replace') {
          if (a.item.range.start.line !== b.item.range.start.line) {
            return b.item.range.start.line - a.item.range.start.line;
          }
          return b.item.range.start.character - a.item.range.start.character;
        }
        if (a.item.type === 'insert' && b.item.type === 'insert' && a.item.line !== b.item.line) {
          return b.item.line - a.item.line;
        }
        return a.index - b.index;
      });
    for (const { item } of orderedEdits) {
      if (item.type === 'insert') {
        edit.insert(uri, new vscode.Position(item.line, 0), replaceName(item.text));
      } else {
        edit.replace(
          uri,
          new vscode.Range(
            new vscode.Position(item.range.start.line, item.range.start.character),
            new vscode.Position(item.range.end.line, item.range.end.character)
          ),
          replaceName(item.text)
        );
      }
    }
    await vscode.workspace.applyEdit(edit);
  };

  const applyRefactorPlan = async (payload: RefactorEditPlanPayload) => {
    const uri = vscode.Uri.parse(payload.uri);
    const edit = new vscode.WorkspaceEdit();
    for (const item of payload.edits) {
      edit.replace(
        uri,
        new vscode.Range(
          new vscode.Position(item.range.start.line, item.range.start.character),
          new vscode.Position(item.range.end.line, item.range.end.character)
        ),
        item.text
      );
    }
    await vscode.workspace.applyEdit(edit);
    if (!payload.selection) return;
    const editor =
      vscode.window.visibleTextEditors.find((candidate) => candidate.document.uri.toString() === payload.uri)
      ?? (vscode.window.activeTextEditor?.document.uri.toString() === payload.uri ? vscode.window.activeTextEditor : undefined);
    if (!editor) return;
    const selection = new vscode.Selection(
      new vscode.Position(payload.selection.start.line, payload.selection.start.character),
      new vscode.Position(payload.selection.end.line, payload.selection.end.character)
    );
    editor.selection = selection;
    editor.revealRange(new vscode.Range(selection.start, selection.end));
  };

  const resolveRootDir = (rootDir: string, resource?: vscode.Uri) => {
    if (!rootDir) return '';
    if (path.isAbsolute(rootDir)) return rootDir;
    const workspaceFolder = resource ? vscode.workspace.getWorkspaceFolder(resource) : vscode.workspace.workspaceFolders?.[0];
    return workspaceFolder ? path.join(workspaceFolder.uri.fsPath, rootDir) : rootDir;
  };

  const findConfigContextForResource = (
    resource?: vscode.Uri
  ): { scope: 'workspace' | 'user'; index: number; context: ContextConfig } | null => {
    if (!resource || resource.scheme !== 'file') return null;
    const filePath = resource.fsPath;

    const findInScope = (scope: 'workspace' | 'user') => {
      const contexts = readContextsConfig(contextConfigAccessor, scope, resource);
      for (let index = 0; index < contexts.length; index += 1) {
        const ctx = contexts[index];
        const resolvedContext: ContextConfig = {
          ...ctx,
          rootDir: resolveRootDir(ctx.rootDir, resource)
        };
        if (fileBelongsToContext(resolvedContext, filePath)) {
          return { scope, index, context: ctx };
        }
      }
      return null;
    };

    return findInScope('workspace') ?? findInScope('user');
  };

  const normalizeContextPattern = (ctx: ContextConfig) =>
    ctx.includeSubdirectories || ctx.filePattern.startsWith('re:') ? ctx.filePattern : path.basename(ctx.filePattern);

  const resolveMatchesForContext = (ctx: ContextConfig, resource?: vscode.Uri): string[] => {
    const root = resolveRootDir(ctx.rootDir, resource);
    if (!root || !fs.existsSync(root)) return [];
    try {
      if (ctx.filePattern.startsWith('re:')) {
        const expr = ctx.filePattern.slice(3);
        const regex = new RegExp(expr);
        const files = fg.sync(['**/*'], { cwd: root, dot: false, onlyFiles: true });
        return files.filter((f) => regex.test(path.basename(f))).map((f) => path.resolve(root, f));
      }
      const pattern = normalizeContextPattern(ctx);
      const files = fg.sync([pattern], {
        cwd: root,
        dot: false,
        onlyFiles: true,
        deep: ctx.includeSubdirectories ? undefined : 1
      });
      return files.map((f) => path.resolve(root, f));
    } catch {
      return [];
    }
  };

  const summarizeMatches = (matches: string[], limit = 5) => {
    if (matches.length === 0) return 'nenhum arquivo encontrado';
    const top = matches.slice(0, limit).map((f) => path.basename(f));
    const suffix = matches.length > limit ? ` +${matches.length - limit}` : '';
    return `${matches.length} arquivo(s): ${top.join(', ')}${suffix}`;
  };

  const suggestContextTemplates = (resource?: vscode.Uri): ContextTemplate[] => {
    const folderUri = resource ?? vscode.window.activeTextEditor?.document.uri ?? vscode.workspace.workspaceFolders?.[0]?.uri;
    const rootHint = folderUri ? vscode.workspace.getWorkspaceFolder(folderUri)?.uri.fsPath ?? '' : '';
    return [
      {
        label: 'HR (*.txt)',
        description: 'Padrão típico HR sem subdiretórios',
        rootDir: rootHint || '.',
        filePattern: 'HR*.txt',
        includeSubdirectories: false,
        system: 'HCM'
      },
      {
        label: 'Arquivos .lspt (recursivo)',
        description: 'Projeto padrão com subdiretórios',
        rootDir: rootHint || '.',
        filePattern: '**/*.lspt',
        includeSubdirectories: true,
        system: 'HCM'
      },
      {
        label: 'Regex customizado',
        description: 'Começa com re: e usa regex no basename',
        rootDir: rootHint || '.',
        filePattern: 're:^HR.*\\.txt$',
        includeSubdirectories: false,
        system: 'HCM'
      },
      {
        label: 'Manual',
        description: 'Preencher sem template',
        rootDir: rootHint || '.',
        filePattern: '',
        includeSubdirectories: false,
        system: 'HCM'
      }
    ];
  };

  const pickContextSystem = async (current?: ContextSystem) => {
    const picked = await vscode.window.showQuickPick(
      contextSystems.map((system) => ({ label: system, system })),
      { placeHolder: 'Selecionar system do contexto' }
    );
    if (!picked) return current ?? null;
    return picked.system;
  };

  const promptContext = async (
    resource?: vscode.Uri,
    current?: ContextConfig,
    existingContexts: ContextConfig[] = [],
    editingIndex: number | null = null
  ): Promise<ContextConfig | null> => {
    let draft: ContextConfig | null = current ? { ...current } : null;
    if (!current) {
      const templates = suggestContextTemplates(resource);
      const chosen = await vscode.window.showQuickPick(
        templates.map((template) => ({
          label: template.label,
          description: template.description,
          template
        })),
        { placeHolder: 'Template inicial do contexto (recomendado)' }
      );
      if (!chosen) return null;
      draft = {
        name: '',
        rootDir: chosen.template.rootDir,
        filePattern: chosen.template.filePattern,
        includeSubdirectories: chosen.template.includeSubdirectories,
        system: chosen.template.system
      };
    }
    if (!draft) return null;

    const name = await vscode.window.showInputBox({
      title: current ? 'Editar Contexto' : 'Criar Contexto',
      prompt: 'Nome do contexto',
      value: draft.name,
      validateInput: (v) => (v.trim() ? undefined : 'Informe um nome de contexto.')
    });
    if (!name) return null;

    const rootDir = await vscode.window.showInputBox({
      title: current ? 'Editar Contexto' : 'Criar Contexto',
      prompt: 'Diretório raiz (absoluto ou relativo ao workspace)',
      value: draft.rootDir,
      validateInput: (v) => (v.trim() ? undefined : 'Informe um diretório raiz.')
    });
    if (!rootDir) return null;

    const filePattern = await vscode.window.showInputBox({
      title: current ? 'Editar Contexto' : 'Criar Contexto',
      prompt: 'Padrão de arquivos (glob ou re:<regex>)',
      value: draft.filePattern,
      validateInput: (v) => {
        const trimmed = v.trim();
        if (!trimmed) return 'Informe um padrão de arquivos.';
        if (trimmed.startsWith('re:')) {
          try {
            new RegExp(trimmed.slice(3));
          } catch {
            return 'Regex inválida. Use re:<expressão> válida.';
          }
        }
        return undefined;
      }
    });
    if (!filePattern) return null;

    const system = await pickContextSystem(draft.system);
    if (!system) return null;

    const includePick = await vscode.window.showQuickPick(
      [
        { label: 'Não incluir subdiretórios', value: false },
        { label: 'Incluir subdiretórios', value: true }
      ],
      {
        placeHolder: 'Subdiretórios',
        canPickMany: false
      }
    );
    if (!includePick) return null;

    const candidate: ContextConfig = {
      name: name.trim(),
      rootDir: rootDir.trim(),
      filePattern: filePattern.trim(),
      includeSubdirectories: includePick.value,
      system,
      diagnostics: draft.diagnostics
        ? {
          ignoreIds: [...(draft.diagnostics.ignoreIds ?? [])]
        }
        : undefined
    };

    const baseContexts = existingContexts.filter((_, index) => index !== editingIndex);
    const simulated = [...baseContexts, candidate];
    const issues = validateContexts(simulated, {
      pathExists: (dir) => fs.existsSync(resolveRootDir(dir, resource)),
      matchFiles: (ctx) => resolveMatchesForContext(ctx, resource)
    }).filter((issue) => issue.contextName === candidate.name);

    const matches = resolveMatchesForContext(candidate, resource);
    output.appendLine(`[contexts][wizard] preview contexto="${candidate.name}"`);
    output.appendLine(`[contexts][wizard] rootDir=${candidate.rootDir} pattern=${candidate.filePattern} includeSub=${candidate.includeSubdirectories} system=${candidate.system}`);
    output.appendLine(`[contexts][wizard] matches=${matches.length}`);
    for (const match of matches.slice(0, 8)) {
      output.appendLine(`[contexts][wizard]   - ${match}`);
    }
    if (issues.length > 0) {
      for (const issue of issues) {
        output.appendLine(`[contexts][wizard][${issue.severity}] ${issue.message}`);
      }
    }
    output.show(true);

    const hasOverlap = issues.some((issue) => issue.code === 'CONTEXT_FILE_CONFLICT');
    if (hasOverlap) {
      void vscode.window.showErrorMessage(
        `LSP: não foi possível salvar o contexto "${candidate.name}" porque há sobreposição de arquivos com outro contexto.`
      );
      return null;
    }

    const summary = summarizeMatches(matches);
    const warnings = issues.length > 0 ? ` | ${issues.length} aviso(s)/erro(s)` : '';
    const confirm = await vscode.window.showQuickPick(
      [
        { label: 'Salvar contexto', value: 'save' },
        { label: 'Cancelar', value: 'cancel' }
      ],
      {
        placeHolder: `Pré-visualização: ${summary}${warnings}. Detalhes no Output "LSP".`
      }
    );
    if (!confirm || confirm.value === 'cancel') return null;
    return candidate;
  };

  const applyContextFixes = async (issues: ReturnType<typeof validateContexts>, resource?: vscode.Uri) => {
    const actions = buildContextFixActions(issues);
    if (actions.length === 0) return;
    const picked = await vscode.window.showQuickPick(
      actions.map((action) => ({
        label: action.label,
        description: action.description,
        action
      })),
      { placeHolder: 'Aplicar correção rápida de contexto (opcional)' }
    );
    if (!picked) return;
    const workspaceContexts = readContextsConfig(contextConfigAccessor, 'workspace', resource);
    if (picked.action.kind === 'disable') {
      const next = disableContextByName(workspaceContexts, picked.action.contextName);
      if (next.length !== workspaceContexts.length) {
        await writeContextsConfig(contextConfigAccessor, 'workspace', next, resource);
        void vscode.window.showInformationMessage(`LSP: contexto "${picked.action.contextName}" desabilitado.`);
      }
      return;
    }
    const index = workspaceContexts.findIndex((ctx) => ctx.name === picked.action.contextName);
    if (index < 0) return;
    const updated = await promptContext(resource, workspaceContexts[index], workspaceContexts, index);
    if (!updated) return;
    workspaceContexts[index] = updated;
    await writeContextsConfig(contextConfigAccessor, 'workspace', workspaceContexts, resource);
    void vscode.window.showInformationMessage(`LSP: contexto "${updated.name}" atualizado.`);
  };

  const validateAndReportContexts = async () => {
    const resource = getActiveResource();
    const contexts = getEffectiveContexts(contextConfigAccessor, resource);
    const issues = validateContexts(contexts, {
      pathExists: (rootDir) => fs.existsSync(resolveRootDir(rootDir, resource)),
      matchFiles: (ctx) => resolveMatchesForContext(ctx, resource)
    });
    output.appendLine('[contexts] validação iniciada');
    if (issues.length === 0) {
      output.appendLine('[contexts] sem problemas encontrados');
      void vscode.window.showInformationMessage('LSP: contextos válidos.');
      return;
    }
    for (const issue of issues) {
      output.appendLine(`[contexts][${issue.severity}] ${issue.message}`);
    }
    const hasError = issues.some((i) => i.severity === 'ERROR');
    if (hasError) {
      void vscode.window.showErrorMessage(`LSP: validação encontrou ${issues.length} problema(s). Veja o Output "LSP".`);
    } else {
      void vscode.window.showWarningMessage(`LSP: validação encontrou ${issues.length} aviso(s). Veja o Output "LSP".`);
    }
    await applyContextFixes(issues, resource);
  };

  const FALLBACK_KEY = 'lsp.fallback.selectedSystem';
  const fallbackStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  fallbackStatusItem.command = 'lsp.fallback.selectSystem';
  fallbackStatusItem.tooltip = 'System adicional usado no modo SingleFile (fora de contextos)';
  context.subscriptions.push(fallbackStatusItem);

  const getFallbackOverride = () => context.workspaceState.get<FallbackSystem | null | undefined>(FALLBACK_KEY);
  const getFallbackDefault = (resource?: vscode.Uri | null) => {
    const config = vscode.workspace.getConfiguration('lsp', resource ?? undefined);
    return normalizeFallbackSystem(config.get('fallback.defaultSystem'));
  };
  const getContextInfo = async (editor?: vscode.TextEditor | null) => {
    if (!client) return { inContext: false, contextKey: null as string | null, contextName: null as string | null };
    const uri = editor?.document?.uri;
    if (!uri) return { inContext: false, contextKey: null, contextName: null };
    try {
      return (await client.sendRequest('lsp/contextForFile', { uri: uri.toString() })) as {
        inContext: boolean;
        contextKey: string | null;
        contextName: string | null;
      };
    } catch {
      return { inContext: false, contextKey: null, contextName: null };
    }
  };

  const updateFallbackStatus = async (editor?: vscode.TextEditor | null) => {
    // Only show the fallback selector when the active file is a SingleFile (i.e. outside any configured context).
    if (!editor || editor.document.languageId !== 'lsp') {
      fallbackStatusItem.hide();
      return;
    }
    const override = getFallbackOverride();
    const settingsDefault = getFallbackDefault(editor?.document?.uri);
    const effective = resolveEffectiveFallbackSystem({ override, settingsDefault });
    fallbackStatusItem.text = formatStatusBarText(effective);
    const contextInfo = await getContextInfo(editor);
    if (contextInfo.inContext) {
      fallbackStatusItem.hide();
      return;
    } else {
      fallbackStatusItem.command = 'lsp.fallback.selectSystem';
      fallbackStatusItem.tooltip = 'System adicional usado no modo SingleFile (fora de contextos)';
    }
    fallbackStatusItem.show();
  };

  client.onNotification('lsp/log', (payload: { level: 'error' | 'warn' | 'info' | 'debug' | 'trace'; message: string; timestamp?: string; id?: string; cycleId?: string; span?: string; durationMs?: number }) => {
    const level = payload?.level ?? 'info';
    const message = payload?.message ?? '';
    const timestamp = payload?.timestamp ?? '';
    const id = payload?.id ? ` ${payload.id}` : '';
    const cycle = payload?.cycleId ? ` cycle=${payload.cycleId}` : '';
    const span = payload?.span ? ` span=${payload.span}` : '';
    const duration = Number.isFinite(payload?.durationMs) ? ` ${payload.durationMs}ms` : '';
    const prefix = timestamp ? `[${timestamp}]` : '';
    output.appendLine(`${prefix}[${level}]${id}${cycle}${span}${duration} ${message}`.trim());
  });

  const notifyActiveEditor = (editor?: vscode.TextEditor | null) => {
    const uri = editor?.document?.uri?.toString() ?? null;
    void client?.sendNotification('lsp/activeDocumentChanged', { uri });
    void updateFallbackStatus(editor);
  };

  const notifyWindowFocus = (focused: boolean) => {
    void client?.sendNotification('lsp/windowFocusChanged', { focused });
  };

  clientStart.then(() => {
    const override = getFallbackOverride();
    if (override !== undefined) {
      void client?.sendNotification('lsp/fallbackSystemChanged', { system: override });
    }
    notifyWindowFocus(vscode.window.state.focused);
    notifyActiveEditor(vscode.window.activeTextEditor);
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(notifyActiveEditor));
    context.subscriptions.push(vscode.window.onDidChangeWindowState((state) => notifyWindowFocus(state.focused)));
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('lsp.quickfix.applyEditPlan', async (payload: QuickFixEditPlanPayload) => {
      if (!payload || payload.version !== 1) return;
      const suggested = payload.rename?.suggestedName;
      await applyQuickFixPlan(payload, suggested);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('lsp.quickfix.applyWithNamePrompt', async (payload: QuickFixEditPlanPayload) => {
      if (!payload || payload.version !== 1) return;
      const suggested = payload.rename?.suggestedName ?? '';
      await applyQuickFixWithPrompt(payload.title, suggested, {
        askName: async (defaultValue, title) =>
          vscode.window.showInputBox({
            title,
            prompt: 'Confirme o nome da variável',
            value: defaultValue,
            validateInput: (value) => {
              const trimmed = value.trim();
              if (!trimmed) return 'Informe um nome.';
              if (!isValidIdentifier(trimmed)) return 'Use um identificador válido (A-Za-z_ seguido de A-Za-z0-9_).';
              return undefined;
            }
          }),
        apply: async (finalName) => applyQuickFixPlan(payload, finalName),
        validateIdentifier: isValidIdentifier
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('lsp.refactor.applyEditPlan', async (payload: RefactorEditPlanPayload) => {
      await applyRefactorPlan(payload);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('lsp.fallback.selectSystem', async () => {
      const activeEditor = vscode.window.activeTextEditor;
      const contextInfo = await getContextInfo(activeEditor);
      if (contextInfo.inContext) {
        void vscode.window.showWarningMessage(
          `Não é permitido trocar o system de um arquivo que pertence ao contexto "${contextInfo.contextName ?? 'contexto'}".`
        );
        return;
      }
      const picks: Array<{ label: string; system: FallbackSystem }> = [
        { label: 'Core (SENIOR)', system: null },
        { label: 'HCM', system: 'HCM' },
        { label: 'ACESSO', system: 'ACESSO' },
        { label: 'ERP', system: 'ERP' }
      ];
      const selection = await vscode.window.showQuickPick(picks, {
        placeHolder: 'Selecionar system adicional para modo SingleFile'
      });
      if (!selection) return;
      await context.workspaceState.update(FALLBACK_KEY, selection.system);
      void updateFallbackStatus(vscode.window.activeTextEditor);
      void client?.sendNotification('lsp/fallbackSystemChanged', { system: selection.system });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('lsp.contexts.create', async () => {
      const resource = getActiveResource();
      const workspaceContexts = readContextsConfig(contextConfigAccessor, 'workspace', resource);
      const next = await promptContext(resource, undefined, workspaceContexts, null);
      if (!next) return;
      workspaceContexts.push(next);
      await writeContextsConfig(contextConfigAccessor, 'workspace', workspaceContexts, resource);
      await validateAndReportContexts();
      void vscode.window.showInformationMessage(`LSP: contexto "${next.name}" criado.`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('lsp.contexts.edit', async () => {
      const resource = getActiveResource();
      const workspaceContexts = readContextsConfig(contextConfigAccessor, 'workspace', resource);
      if (workspaceContexts.length === 0) {
        void vscode.window.showWarningMessage('LSP: não há contextos no workspace para editar.');
        return;
      }

      const picked = await vscode.window.showQuickPick(
        workspaceContexts.map((ctx, index) => ({
          label: ctx.name,
          description: `${ctx.rootDir} | ${ctx.filePattern} | ${ctx.system}`,
          index
        })),
        { placeHolder: 'Selecione o contexto para editar' }
      );
      if (!picked) return;

      const updated = await promptContext(resource, workspaceContexts[picked.index], workspaceContexts, picked.index);
      if (!updated) return;

      workspaceContexts[picked.index] = updated;
      await writeContextsConfig(contextConfigAccessor, 'workspace', workspaceContexts, resource);
      await validateAndReportContexts();
      void vscode.window.showInformationMessage(`LSP: contexto "${updated.name}" atualizado.`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('lsp.contexts.delete', async () => {
      const resource = getActiveResource();
      const workspaceContexts = readContextsConfig(contextConfigAccessor, 'workspace', resource);
      if (workspaceContexts.length === 0) {
        void vscode.window.showWarningMessage('LSP: não há contextos no workspace para remover.');
        return;
      }

      const picked = await vscode.window.showQuickPick(
        workspaceContexts.map((ctx, index) => ({
          label: ctx.name,
          description: `${ctx.rootDir} | ${ctx.filePattern} | ${ctx.system}`,
          index
        })),
        { placeHolder: 'Selecione o contexto para remover' }
      );
      if (!picked) return;

      const removed = workspaceContexts.splice(picked.index, 1)[0];
      await writeContextsConfig(contextConfigAccessor, 'workspace', workspaceContexts, resource);
      await validateAndReportContexts();
      void vscode.window.showInformationMessage(`LSP: contexto "${removed.name}" removido.`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('lsp.contexts.validate', async () => {
      await validateAndReportContexts();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('lsp.contexts.openSettings', async () => {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'lsp.contexts');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('lsp.diagnostics.ignoreId', async (rawCode: string, scope: 'workspace' | 'user' | 'context' = 'workspace', uri?: vscode.Uri) => {
      const code = normalizeDiagnosticCode(String(rawCode ?? ''));
      if (!code) return;

      const resource = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (scope === 'context') {
        const match = findConfigContextForResource(resource);
        if (!match) {
          void vscode.window.showInformationMessage('LSP: ignorar por contexto não está disponível no modo SingleFile.');
          return;
        }
        const contexts = readContextsConfig(contextConfigAccessor, match.scope, resource);
        const target = contexts[match.index];
        if (!target) return;
        const current = target.diagnostics?.ignoreIds ?? [];
        contexts[match.index] = {
          ...target,
          diagnostics: {
            ...(target.diagnostics ?? {}),
            ignoreIds: mergeIgnoredCodes(current, code)
          }
        };
        await writeContextsConfig(contextConfigAccessor, match.scope, contexts, resource);
        return;
      }
      const config = vscode.workspace.getConfiguration('lsp', resource);
      const current = config.get<string[]>('diagnostics.ignoreIds', []);
      const next = mergeIgnoredCodes(current, code);
      const target = scope === 'workspace' ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
      await config.update('diagnostics.ignoreIds', next, target);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('lsp.diagnostics.unignoreId', async (rawCode: string, scope: 'workspace' | 'user' | 'context' = 'workspace', uri?: vscode.Uri) => {
      const code = normalizeDiagnosticCode(String(rawCode ?? ''));
      if (!code) return;
      const resource = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (scope === 'context') {
        const match = findConfigContextForResource(resource);
        if (!match) {
          void vscode.window.showInformationMessage('LSP: ignorar por contexto não está disponível no modo SingleFile.');
          return;
        }
        const contexts = readContextsConfig(contextConfigAccessor, match.scope, resource);
        const target = contexts[match.index];
        if (!target) return;
        const current = target.diagnostics?.ignoreIds ?? [];
        const next = removeIgnoredCode(current, code);
        contexts[match.index] = {
          ...target,
          diagnostics: next.length > 0 ? { ...(target.diagnostics ?? {}), ignoreIds: next } : undefined
        };
        await writeContextsConfig(contextConfigAccessor, match.scope, contexts, resource);
        return;
      }
      const config = vscode.workspace.getConfiguration('lsp', resource);
      const current = config.get<string[]>('diagnostics.ignoreIds', []);
      const next = removeIgnoredCode(current, code);
      const target = scope === 'workspace' ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
      await config.update('diagnostics.ignoreIds', next, target);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('lsp.diagnostics.listIgnoredIds', async (uri?: vscode.Uri) => {
      const resource = uri ?? vscode.window.activeTextEditor?.document.uri;
      const config = vscode.workspace.getConfiguration('lsp', resource);
      const inspected = config.inspect<string[]>('diagnostics.ignoreIds');
      const effective = listEffectiveIgnoredCodes({
        workspace: inspected?.workspaceValue ?? [],
        user: inspected?.globalValue ?? []
      });
      output.appendLine(`[diagnostics] ignored IDs effective: ${effective.length > 0 ? effective.join(', ') : '(none)'}`);
      output.show(true);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('lsp.diagnostics.clearIgnoredIdsWorkspace', async (uri?: vscode.Uri) => {
      const resource = uri ?? vscode.window.activeTextEditor?.document.uri;
      const config = vscode.workspace.getConfiguration('lsp', resource);
      const inspected = config.inspect<string[]>('diagnostics.ignoreIds');
      const next = clearIgnoredCodes({
        workspace: inspected?.workspaceValue ?? [],
        user: inspected?.globalValue ?? []
      }, 'workspace');
      await config.update('diagnostics.ignoreIds', next.workspace, vscode.ConfigurationTarget.Workspace);
      void vscode.window.showInformationMessage('LSP: IDs ignorados do workspace foram limpos.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('lsp.diagnostics.clearIgnoredIdsUser', async (uri?: vscode.Uri) => {
      const resource = uri ?? vscode.window.activeTextEditor?.document.uri;
      const config = vscode.workspace.getConfiguration('lsp', resource);
      const inspected = config.inspect<string[]>('diagnostics.ignoreIds');
      const next = clearIgnoredCodes({
        workspace: inspected?.workspaceValue ?? [],
        user: inspected?.globalValue ?? []
      }, 'user');
      await config.update('diagnostics.ignoreIds', next.user, vscode.ConfigurationTarget.Global);
      void vscode.window.showInformationMessage('LSP: IDs ignorados do usuário foram limpos.');
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('lsp.fallback.defaultSystem')) {
        void updateFallbackStatus(vscode.window.activeTextEditor);
      }
    })
  );

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider('lsp', {
      provideCodeActions(document, selectedRange, context) {
        const allowQuickFix = !context.only || context.only.contains(vscode.CodeActionKind.QuickFix);
        const allowRefactor = !context.only || context.only.contains(vscode.CodeActionKind.Refactor);
        if (!allowQuickFix && !allowRefactor) {
          return [];
        }
        const actions: vscode.CodeAction[] = [];
        function extractQuickFixIdentifier(raw: string, message: string): string | null {
          const normalize = (value: string): string => {
            let v = (value ?? '').trim();
            if (!v) return '';
            // Keep last segment for member access (obj.aVar -> aVar)
            if (v.includes('.')) v = v.split('.').pop() ?? v;
            // Strip common trailing/leading punctuation
            v = v.replace(/^[^A-Za-z_]+/, '').replace(/[^A-Za-z0-9_]+$/, '');
            // Strip indexing/call suffixes
            v = v.replace(/\[.*$/, '').replace(/\(.*$/, '');
            return /^[A-Za-z_][A-Za-z0-9_]*$/.test(v) ? v : '';
          };

          const fromRange = normalize(raw);
          if (fromRange) return fromRange;

          // Fallback: try to extract from diagnostic message (quoted or last identifier).
          const quoted = /'([A-Za-z_][A-Za-z0-9_]*)'/.exec(message);
          if (quoted) return quoted[1];

          const all = (message.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []).filter((t) => !/^LSP\d+$/.test(t));
          if (all.length === 0) return null;

          // Heuristic: last identifier in the message is usually the symbol name.
          const candidate = all[all.length - 1];
          return /^[A-Za-z_][A-Za-z0-9_]*$/.test(candidate) ? candidate : null;
        }
        const targetDiagnostics = context.diagnostics.filter(
          (d) =>
            d.code === 'LSP0001' ||
            d.code === 'LSP1404' ||
            d.code === 'LSP1204' ||
            d.code === 'LSP1003' ||
            d.code === 'LSP1005'
        );
        if (allowQuickFix && targetDiagnostics.length > 0) {
          for (const diag of targetDiagnostics) {
            const range = diag.range;
            const diagCode = String(diag.code ?? '');
            const rawName = document.getText(range);
            const extractedName = diagCode === 'LSP0001' ? '' : extractQuickFixIdentifier(rawName, String(diag.message ?? ''));
            if (diagCode !== 'LSP0001' && !extractedName) continue;

            const formatConfig = vscode.workspace.getConfiguration('lsp', document.uri);
            const plans = buildQuickFixPlans({
              docText: document.getText(),
              diagCode,
              diagMessage: diag.message,
              range: {
                start: { line: range.start.line, character: range.start.character },
                end: { line: range.end.line, character: range.end.character }
              },
              name: diagCode === 'LSP0001' ? '' : (extractedName ?? ''),
              settings: {
                indentSize: Number(formatConfig.get('format.indentSize', 2)),
                useTabs: Boolean(formatConfig.get('format.useTabs', false))
              }
            });

            for (const plan of plans) {
              const action = new vscode.CodeAction(plan.title, vscode.CodeActionKind.QuickFix);
              action.diagnostics = [diag];
              const payload: QuickFixEditPlanPayload = {
                version: 1,
                title: plan.title,
                uri: document.uri.toString(),
                edits: plan.edits,
                rename: plan.rename
              };
              action.command = {
                command: plan.rename?.requiresConfirmation ? 'lsp.quickfix.applyWithNamePrompt' : 'lsp.quickfix.applyEditPlan',
                title: plan.title,
                arguments: [payload]
              };
              actions.push(action);
            }
          }
        }

        const config = vscode.workspace.getConfiguration('lsp', document.uri);
        if (allowQuickFix) {
          const inspected = config.inspect<string[]>('diagnostics.ignoreIds');
          const ignoredWorkspace = new Set((inspected?.workspaceValue ?? []).map((v) => normalizeDiagnosticCode(String(v))));
          const ignoredUser = new Set((inspected?.globalValue ?? []).map((v) => normalizeDiagnosticCode(String(v))));
          const matchedContext = findConfigContextForResource(document.uri);
          const ignoredContext = new Set(
            (matchedContext?.context.diagnostics?.ignoreIds ?? []).map((v) => normalizeDiagnosticCode(String(v)))
          );
          const uniqueById = new Map<string, vscode.Diagnostic>();
          for (const diag of context.diagnostics) {
            const code = typeof diag.code === 'string' || typeof diag.code === 'number' ? String(diag.code) : '';
            const normalized = normalizeDiagnosticCode(code);
            if (!normalized) continue;
            if (!uniqueById.has(normalized)) {
              uniqueById.set(normalized, diag);
            }
          }

          for (const [id, diag] of uniqueById.entries()) {
            if (matchedContext) {
              const ignoreContextAction = new vscode.CodeAction(`Ignore ${id} (Context: ${matchedContext.context.name})`, vscode.CodeActionKind.QuickFix);
              ignoreContextAction.diagnostics = [diag];
              ignoreContextAction.command = {
                command: 'lsp.diagnostics.ignoreId',
                title: ignoreContextAction.title,
                arguments: [id, 'context', document.uri]
              };
              actions.push(ignoreContextAction);
            }

            const ignoreWorkspaceAction = new vscode.CodeAction(`Ignore ${id} (Workspace)`, vscode.CodeActionKind.QuickFix);
            ignoreWorkspaceAction.diagnostics = [diag];
            ignoreWorkspaceAction.command = {
              command: 'lsp.diagnostics.ignoreId',
              title: ignoreWorkspaceAction.title,
              arguments: [id, 'workspace', document.uri]
            };
            actions.push(ignoreWorkspaceAction);

            const ignoreUserAction = new vscode.CodeAction(`Ignore ${id} (User)`, vscode.CodeActionKind.QuickFix);
            ignoreUserAction.diagnostics = [diag];
            ignoreUserAction.command = {
              command: 'lsp.diagnostics.ignoreId',
              title: ignoreUserAction.title,
              arguments: [id, 'user', document.uri]
            };
            actions.push(ignoreUserAction);

            if (matchedContext && ignoredContext.has(id)) {
              const unignoreContextAction = new vscode.CodeAction(`Stop ignoring ${id} (Context: ${matchedContext.context.name})`, vscode.CodeActionKind.QuickFix);
              unignoreContextAction.diagnostics = [diag];
              unignoreContextAction.command = {
                command: 'lsp.diagnostics.unignoreId',
                title: unignoreContextAction.title,
                arguments: [id, 'context', document.uri]
              };
              actions.push(unignoreContextAction);
            }

            if (ignoredWorkspace.has(id)) {
              const unignoreWorkspaceAction = new vscode.CodeAction(`Stop ignoring ${id} (Workspace)`, vscode.CodeActionKind.QuickFix);
              unignoreWorkspaceAction.diagnostics = [diag];
              unignoreWorkspaceAction.command = {
                command: 'lsp.diagnostics.unignoreId',
                title: unignoreWorkspaceAction.title,
                arguments: [id, 'workspace', document.uri]
              };
              actions.push(unignoreWorkspaceAction);
            }

            if (ignoredUser.has(id)) {
              const unignoreUserAction = new vscode.CodeAction(`Stop ignoring ${id} (User)`, vscode.CodeActionKind.QuickFix);
              unignoreUserAction.diagnostics = [diag];
              unignoreUserAction.command = {
                command: 'lsp.diagnostics.unignoreId',
                title: unignoreUserAction.title,
                arguments: [id, 'user', document.uri]
              };
              actions.push(unignoreUserAction);
            }
          }
        }

        if (allowRefactor) {
          const blockStyle = config.get<RefactorBlockStyle>('refactor.defaultBlockStyle', 'inicioFim');
          const refactorPlans = buildRefactorPlans({
            docText: document.getText(),
            selection: {
              start: { line: selectedRange.start.line, character: selectedRange.start.character },
              end: { line: selectedRange.end.line, character: selectedRange.end.character }
            },
            locale: vscode.env.language,
            defaultBlockStyle: blockStyle,
            settings: {
              indentSize: Number(config.get('format.indentSize', 2)),
              useTabs: Boolean(config.get('format.useTabs', false))
            }
          });
          for (const plan of refactorPlans) {
            const action = new vscode.CodeAction(plan.title, vscode.CodeActionKind.Refactor);
            const payload: RefactorEditPlanPayload = {
              version: 1,
              title: plan.title,
              uri: document.uri.toString(),
              edits: plan.edits,
              selection: plan.selection
            };
            action.command = {
              command: 'lsp.refactor.applyEditPlan',
              title: plan.title,
              arguments: [payload]
            };
            actions.push(action);
          }
        }

        return actions;
      }
    }, {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix, vscode.CodeActionKind.Refactor]
    })
  );
}

export async function deactivate() {
  if (!client) return;
  await client.stop();
  client = null;
}
