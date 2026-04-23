import { performance } from 'node:perf_hooks';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

export type ObservabilitySettings = {
  enabled: boolean;
  level: LogLevel;
  persistToFile?: string;
  persistMaxFileBytes?: number;
  persistMaxFiles?: number;
};

export type LogPayload = {
  level: LogLevel;
  message: string;
  timestamp: string;
  id?: string;
  cycleId?: string;
  span?: string;
  durationMs?: number;
  /** Optional structured payload for debug/trace scenarios (persisted to jsonl when enabled). */
  data?: unknown;
};

export type LogMeta = {
  id?: string;
  cycleId?: string;
  span?: string;
  durationMs?: number;
  /** Optional structured payload for debug/trace scenarios (persisted to jsonl when enabled). */
  data?: unknown;
};

type LogSink = (payload: LogPayload) => void;
type LogApi = {
  log: (settings: ObservabilitySettings, level: LogLevel, message: string, meta?: LogMeta) => void;
};

export const OBSERVABILITY_SCHEMA_VERSION = 1;

export type CorrelationContext = {
  requestId?: string;
  contextKey?: string;
  contextName?: string;
  uri?: string;
  docVersion?: number;
  dirtyStamp?: number | null;
  compileGeneration?: number;
  resultId?: string;
  phase?: string;
};

export function createCorrelationContext(input: CorrelationContext): CorrelationContext {
  return { ...input };
}

export function recordMetric(
  api: LogApi,
  settings: ObservabilitySettings,
  metric: string,
  value: number,
  correlation?: CorrelationContext,
  extraData?: Record<string, unknown>
): void {
  api.log(settings, 'debug', `metric.${metric}`, {
    id: correlation?.requestId,
    span: correlation?.phase,
    data: {
      schemaVersion: OBSERVABILITY_SCHEMA_VERSION,
      recordKind: 'metric',
      metric,
      value,
      ...(correlation ? { correlation } : {}),
      ...(extraData ?? {})
    }
  });
}

export function recordDecisionEvent(
  api: LogApi,
  settings: ObservabilitySettings,
  event: string,
  decision: string,
  reason: string | null,
  correlation?: CorrelationContext,
  extraData?: Record<string, unknown>
): void {
  api.log(settings, 'debug', `decision.${event}`, {
    id: correlation?.requestId,
    span: correlation?.phase,
    data: {
      schemaVersion: OBSERVABILITY_SCHEMA_VERSION,
      recordKind: 'decision',
      event,
      decision,
      reason,
      ...(correlation ? { correlation } : {}),
      ...(extraData ?? {})
    }
  });
}

type PersistWriter = (payload: LogPayload, filePath: string) => void | Promise<void>;

type Clock = {
  now: () => number;
  perfNow: () => number;
};

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4
};

export function shouldLog(settings: ObservabilitySettings, level: LogLevel): boolean {
  if (!settings.enabled) return false;
  const threshold = LEVEL_WEIGHT[settings.level] ?? LEVEL_WEIGHT.info;
  return LEVEL_WEIGHT[level] <= threshold;
}

export function createObservability(input: {
  sink: LogSink;
  persistWriter?: PersistWriter;
  clock?: Clock;
}) {
  const { sink, persistWriter } = input;
  const clock: Clock = input.clock ?? {
    now: () => Date.now(),
    perfNow: () => performance.now()
  };

  function log(settings: ObservabilitySettings, level: LogLevel, message: string, meta?: LogMeta): void {
    if (!shouldLog(settings, level)) return;
    const payload: LogPayload = {
      level,
      message,
      timestamp: new Date(clock.now()).toISOString(),
      id: meta?.id,
      cycleId: meta?.cycleId,
      span: meta?.span,
      durationMs: meta?.durationMs,
      data: meta?.data
    };
    sink(payload);
    const persistPath = settings.persistToFile?.trim();
    if (persistWriter && persistPath) {
      void persistWriter(payload, persistPath);
    }
  }

  function span(settings: ObservabilitySettings, name: string, meta?: LogMeta & { level?: LogLevel }): () => void {
    if (!shouldLog(settings, meta?.level ?? 'debug')) return () => undefined;
    const start = clock.perfNow();
    return () => {
      const durationMs = Math.round(clock.perfNow() - start);
      log(settings, meta?.level ?? 'debug', name, { ...meta, span: name, durationMs });
    };
  }

  return {
    log,
    span,
    shouldLog
  };
}
