import path from 'node:path';
import type { WorkspaceFolder } from 'vscode-languageserver/node';
import { type FormatSettings } from '../../formatting';
import { type FallbackSystem, normalizeFallbackSystem } from '../fallback/fallback-utils';
import { type LogLevel, type ObservabilitySettings } from '../../observability';
import { toFsPath } from '../runtime/path-utils';

type WorkspaceConfigurationReader = {
  workspace: {
    getConfiguration: (section: unknown) => Promise<unknown>;
  };
};

type DebugSettings = {
  enabled: boolean;
  dir: string;
};

type MetricsPersistSettings = {
  persistToFile: string;
  persistMaxFileBytes: number;
  persistMaxFiles: number;
};

type FormatDefaults = {
  indentSize: number;
  useTabs: boolean;
  maxParamsPerLine: number;
  embeddedSqlEnabled: boolean;
  embeddedSqlDialect: 'sql' | 'oracle' | 'sqlserver';
};

export type SemanticHighlightSettings = {
  embeddedSqlHighlightEnabled: boolean;
};

export function normalizeDiagnosticId(id: string): string
{
  return id.trim().toUpperCase();
}

function buildIgnoredSet(values: unknown): Set<string>
{
  if (!Array.isArray(values)) return new Set<string>();
  const set = new Set<string>();
  for (const value of values)
  {
    if (typeof value !== 'string') continue;
    const normalized = normalizeDiagnosticId(value);
    if (normalized) set.add(normalized);
  }
  return set;
}

export function buildIgnoredList(values: unknown): string[]
{
  return [...buildIgnoredSet(values)];
}

export async function loadIgnoredDiagnosticsFromSettings(
  connection: WorkspaceConfigurationReader,
  workspaceFolders: WorkspaceFolder[]
): Promise<Map<string, Set<string>>>
{
  const globalRaw = (await connection.workspace.getConfiguration('lsp.diagnostics.ignoreIds')) as string[] | null;
  const globalSet = buildIgnoredSet(globalRaw ?? []);
  if (workspaceFolders.length === 0)
  {
    const map = new Map<string, Set<string>>();
    map.set('', globalSet);
    return map;
  }

  const requests = workspaceFolders.map((folder) => ({
    scopeUri: folder.uri,
    section: 'lsp.diagnostics.ignoreIds'
  }));
  const configs = (await connection.workspace.getConfiguration(requests)) as Array<string[] | null>;
  const map = new Map<string, Set<string>>();
  for (let i = 0; i < configs.length; i += 1)
  {
    const folder = workspaceFolders[i];
    const workspaceSet = buildIgnoredSet(configs[i] ?? []);
    map.set(folder.uri, new Set<string>([...globalSet, ...workspaceSet]));
  }
  return map;
}

function resolvePersistPath(raw: unknown, workspaceUri: string): string
{
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return '';
  if (path.isAbsolute(value)) return value;
  const root = workspaceUri ? toFsPath(workspaceUri) : '';
  return root ? path.join(root, value) : '';
}

function resolveDebugDir(raw: unknown, workspaceUri: string): string
{
  const dir = resolvePersistPath(raw, workspaceUri);
  if (!dir) return '';
  const ext = path.extname(dir);
  if (ext)
  {
    return path.dirname(dir);
  }
  return dir;
}

function normalizeObservabilityLevelForDebug(enabled: boolean): LogLevel
{
  return enabled ? 'debug' : 'info';
}

function buildDebugFilePaths(dir: string): { metricsFile: string; observabilityFile: string }
{
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    metricsFile: path.join(dir, `lsp-metrics-${stamp}.jsonl`),
    observabilityFile: path.join(dir, `lsp-observability-${stamp}.jsonl`)
  };
}

export function buildObservabilitySettingsFromDebug(
  input: { enabled: boolean; dir: string },
  defaultObservabilitySettings: ObservabilitySettings
): ObservabilitySettings
{
  if (!input.enabled || !input.dir)
  {
    return { ...defaultObservabilitySettings };
  }
  const files = buildDebugFilePaths(input.dir);
  return {
    enabled: true,
    level: normalizeObservabilityLevelForDebug(true),
    persistToFile: files.observabilityFile,
    persistMaxFileBytes: 10 * 1024 * 1024,
    persistMaxFiles: 20
  };
}

export function buildMetricsPersistSettingsFromDebug(input: DebugSettings): MetricsPersistSettings
{
  if (!input.enabled || !input.dir)
  {
    return { persistToFile: '', persistMaxFileBytes: 10 * 1024 * 1024, persistMaxFiles: 20 };
  }
  const files = buildDebugFilePaths(input.dir);
  return {
    persistToFile: files.metricsFile,
    persistMaxFileBytes: 10 * 1024 * 1024,
    persistMaxFiles: 20
  };
}

export async function loadDebugSettingsFromSettings(
  connection: WorkspaceConfigurationReader,
  workspaceFolders: WorkspaceFolder[]
): Promise<Map<string, DebugSettings>>
{
  if (workspaceFolders.length === 0)
  {
    const enabledRaw = (await connection.workspace.getConfiguration('lsp.debug.enabled')) as boolean | null;
    const pathRaw = (await connection.workspace.getConfiguration('lsp.debug.path')) as string | null;
    const map = new Map<string, DebugSettings>();
    map.set('', {
      enabled: Boolean(enabledRaw),
      dir: resolveDebugDir(pathRaw, '')
    });
    return map;
  }

  const requests = workspaceFolders.flatMap((folder) => [
    { scopeUri: folder.uri, section: 'lsp.debug.enabled' },
    { scopeUri: folder.uri, section: 'lsp.debug.path' }
  ]);
  const configs = (await connection.workspace.getConfiguration(requests)) as Array<unknown>;
  const map = new Map<string, DebugSettings>();
  let index = 0;
  for (let i = 0; i < workspaceFolders.length; i += 1)
  {
    map.set(workspaceFolders[i].uri, {
      enabled: Boolean(configs[index]),
      dir: resolveDebugDir(configs[index + 1], workspaceFolders[i].uri)
    });
    index += 2;
  }
  return map;
}

function normalizeIndentSize(value: unknown, formatDefaults: FormatDefaults): number
{
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return formatDefaults.indentSize;
  return Math.floor(parsed);
}

function buildFormatSettings(
  values: {
    enabled?: unknown;
    indentSize?: unknown;
    useTabs?: unknown;
    maxParamsPerLine?: unknown;
    embeddedSqlEnabled?: unknown;
    embeddedSqlDialect?: unknown;
  },
  formatDefaults: FormatDefaults
): FormatSettings
{
  const rawMaxParams = typeof values.maxParamsPerLine === 'number' ? values.maxParamsPerLine : Number(values.maxParamsPerLine);
  return {
    enabled: values.enabled === undefined ? true : Boolean(values.enabled),
    indentSize: normalizeIndentSize(values.indentSize, formatDefaults),
    useTabs: values.useTabs === undefined ? formatDefaults.useTabs : Boolean(values.useTabs),
    maxParamsPerLine:
      Number.isFinite(rawMaxParams) && rawMaxParams > 0 ? Math.floor(rawMaxParams) : formatDefaults.maxParamsPerLine,
    embeddedSqlEnabled:
      values.embeddedSqlEnabled === undefined ? formatDefaults.embeddedSqlEnabled : Boolean(values.embeddedSqlEnabled),
    embeddedSqlDialect:
      values.embeddedSqlDialect === 'oracle'
        ? 'oracle'
        : values.embeddedSqlDialect === 'sqlserver'
          ? 'sqlserver'
          : values.embeddedSqlDialect === 'sql'
            ? 'sql'
            : formatDefaults.embeddedSqlDialect
  };
}

export async function loadFormatSettingsFromSettings(
  connection: WorkspaceConfigurationReader,
  workspaceFolders: WorkspaceFolder[],
  formatDefaults: FormatDefaults
): Promise<Map<string, FormatSettings>>
{
  const sections = [
    'lsp.format.enabled',
    'lsp.format.indentSize',
    'lsp.format.useTabs',
    'lsp.format.maxParamsPerLine',
    'lsp.format.embeddedSql.enabled',
    'lsp.format.embeddedSql.dialect'
  ];

  if (workspaceFolders.length === 0)
  {
    const values = await Promise.all(sections.map((section) => connection.workspace.getConfiguration(section)));
    const map = new Map<string, FormatSettings>();
    map.set(
      '',
      buildFormatSettings({
        enabled: values[0],
        indentSize: values[1],
        useTabs: values[2],
        maxParamsPerLine: values[3],
        embeddedSqlEnabled: values[4],
        embeddedSqlDialect: values[5]
      }, formatDefaults)
    );
    return map;
  }

  const requests = workspaceFolders.flatMap((folder) =>
    sections.map((section) => ({
      scopeUri: folder.uri,
      section
    }))
  );
  const configs = (await connection.workspace.getConfiguration(requests)) as Array<unknown>;
  const map = new Map<string, FormatSettings>();
  let index = 0;
  for (let i = 0; i < workspaceFolders.length; i += 1)
  {
    map.set(
      workspaceFolders[i].uri,
      buildFormatSettings({
        enabled: configs[index],
        indentSize: configs[index + 1],
        useTabs: configs[index + 2],
        maxParamsPerLine: configs[index + 3],
        embeddedSqlEnabled: configs[index + 4],
        embeddedSqlDialect: configs[index + 5]
      }, formatDefaults)
    );
    index += sections.length;
  }
  return map;
}

export async function loadSemanticHighlightSettingsFromSettings(
  connection: WorkspaceConfigurationReader,
  workspaceFolders: WorkspaceFolder[]
): Promise<Map<string, SemanticHighlightSettings>>
{
  const section = 'lsp.semantic.embeddedSqlHighlight.enabled';

  if (workspaceFolders.length === 0)
  {
    const raw = await connection.workspace.getConfiguration(section);
    const map = new Map<string, SemanticHighlightSettings>();
    map.set('', {
      embeddedSqlHighlightEnabled: raw === undefined ? false : Boolean(raw)
    });
    return map;
  }

  const requests = workspaceFolders.map((folder) => ({
    scopeUri: folder.uri,
    section
  }));
  const configs = (await connection.workspace.getConfiguration(requests)) as Array<unknown>;
  const map = new Map<string, SemanticHighlightSettings>();
  for (let i = 0; i < workspaceFolders.length; i += 1)
  {
    map.set(workspaceFolders[i].uri, {
      embeddedSqlHighlightEnabled: configs[i] === undefined ? false : Boolean(configs[i])
    });
  }
  return map;
}

export async function loadFallbackDefaultSystemFromSettings(
  connection: WorkspaceConfigurationReader,
  workspaceFolders: WorkspaceFolder[]
): Promise<Map<string, FallbackSystem>>
{
  if (workspaceFolders.length === 0)
  {
    const raw = await connection.workspace.getConfiguration('lsp.fallback.defaultSystem');
    const map = new Map<string, FallbackSystem>();
    map.set('', normalizeFallbackSystem(raw));
    return map;
  }

  const requests = workspaceFolders.map((folder) => ({
    scopeUri: folder.uri,
    section: 'lsp.fallback.defaultSystem'
  }));
  const configs = (await connection.workspace.getConfiguration(requests)) as Array<unknown>;
  const map = new Map<string, FallbackSystem>();
  for (let i = 0; i < configs.length; i += 1)
  {
    map.set(workspaceFolders[i].uri, normalizeFallbackSystem(configs[i]));
  }
  return map;
}
