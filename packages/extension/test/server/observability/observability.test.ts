import { describe, it, expect } from 'vitest';
import { createObservability, type LogPayload, type ObservabilitySettings } from '../../../src/observability';

describe('observability', () => {
  it('respects enabled + level', () => {
    const logs: LogPayload[] = [];
    const obs = createObservability({
      sink: (payload) => logs.push(payload)
    });

    const settings: ObservabilitySettings = {
      enabled: true,
      level: 'info',
      persistToFile: ''
    };

    obs.log(settings, 'debug', 'debug');
    obs.log(settings, 'info', 'info');
    obs.log(settings, 'error', 'error');

    expect(logs.map((l) => l.level)).toEqual(['info', 'error']);
  });

  it('skips logs when disabled', () => {
    const logs: LogPayload[] = [];
    const obs = createObservability({
      sink: (payload) => logs.push(payload)
    });

    const settings: ObservabilitySettings = {
      enabled: false,
      level: 'trace',
      persistToFile: ''
    };

    obs.log(settings, 'error', 'should-not-log');
    expect(logs).toHaveLength(0);
  });

  it('records span duration', () => {
    const logs: LogPayload[] = [];
    const now = 1000;
    let perfNow = 2000;

    const obs = createObservability({
      sink: (payload) => logs.push(payload),
      clock: {
        now: () => now,
        perfNow: () => perfNow
      }
    });

    const settings: ObservabilitySettings = {
      enabled: true,
      level: 'debug',
      persistToFile: ''
    };

    const end = obs.span(settings, 'span.test', { level: 'debug' });
    perfNow = 2015;
    end();

    expect(logs).toHaveLength(1);
    expect(logs[0].span).toBe('span.test');
    expect(logs[0].durationMs).toBe(15);
  });

  it('persists logs when path is provided', () => {
    const logs: LogPayload[] = [];
    const persisted: Array<{ filePath: string; payload: LogPayload }> = [];

    const obs = createObservability({
      sink: (payload) => logs.push(payload),
      persistWriter: (payload, filePath) => {
        persisted.push({ filePath, payload });
      }
    });

    const settings: ObservabilitySettings = {
      enabled: true,
      level: 'info',
      persistToFile: '/tmp/lsp-observability.log'
    };

    obs.log(settings, 'info', 'persisted');

    expect(logs).toHaveLength(1);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].filePath).toBe('/tmp/lsp-observability.log');
    expect(persisted[0].payload.message).toBe('persisted');
  });
});
