import type { InternalSignatureDoc } from '@lsp/compiler';

type HoverPayload = {
  markdown: string;
};

type CreateHoverCacheServiceInput = {
  hoverCache: Map<string, HoverPayload>;
  hoverOfficialEpochBySystem: Map<string, number>;
  hoverCustomEpochByContext: Map<string, number>;
  hoverCustomEpochByFallback: Map<string, number>;
  normalizeSystemForKey: (value: string) => string;
  normalizePathKey: (filePath: string) => string;
  sendLog: (level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: { id?: string }) => void;
};

export function createHoverCacheService(input: CreateHoverCacheServiceInput)
{
  function invalidateHoverCacheByPrefix(prefix: string): void
  {
    const keys = [...input.hoverCache.keys()];
    for (const cacheKey of keys)
    {
      if (cacheKey.startsWith(prefix))
      {
        input.hoverCache.delete(cacheKey);
      }
    }
  }

  function invalidateHoverCacheOfficial(system: string): void
  {
    const systemKey = input.normalizeSystemForKey(system);
    const currentEpoch = input.hoverOfficialEpochBySystem.get(systemKey) ?? 0;
    input.hoverOfficialEpochBySystem.set(systemKey, currentEpoch + 1);
    invalidateHoverCacheByPrefix(`official|${systemKey}|`);
  }

  function invalidateHoverCacheCustomForContext(contextKey: string): void
  {
    const contextKeyNormalized = contextKey.toLowerCase();
    const currentEpoch = input.hoverCustomEpochByContext.get(contextKeyNormalized) ?? 0;
    input.hoverCustomEpochByContext.set(contextKeyNormalized, currentEpoch + 1);
    invalidateHoverCacheByPrefix(`custom|ctx:${contextKeyNormalized}|`);
  }

  function invalidateHoverCacheCustomForFallback(filePath: string): void
  {
    const fallbackKey = input.normalizePathKey(filePath);
    const currentEpoch = input.hoverCustomEpochByFallback.get(fallbackKey) ?? 0;
    input.hoverCustomEpochByFallback.set(fallbackKey, currentEpoch + 1);
    invalidateHoverCacheByPrefix(`custom|fb:${fallbackKey}|`);
  }

  function invalidateAllHoverCaches(): void
  {
    input.hoverCache.clear();
    input.hoverOfficialEpochBySystem.clear();
    input.hoverCustomEpochByContext.clear();
    input.hoverCustomEpochByFallback.clear();
  }

  function buildOfficialHoverCacheKey(inputKey: {
    system: string;
    contextKey: string | null;
    wordKey: string;
    docVersionFingerprint: string;
  }): string
  {
    const systemKey = input.normalizeSystemForKey(inputKey.system);
    const contextToken = inputKey.contextKey ? `ctx:${inputKey.contextKey.toLowerCase()}` : 'fb';
    const epoch = input.hoverOfficialEpochBySystem.get(systemKey) ?? 0;
    return `official|${systemKey}|${contextToken}|${inputKey.wordKey}|e:${epoch}|dv:${inputKey.docVersionFingerprint}`;
  }

  function buildCustomHoverCacheKey(inputKey: {
    contextKey: string | null;
    fallbackPath: string | null;
    wordKey: string;
    symbolFingerprint: string;
  }): string
  {
    if (inputKey.contextKey)
    {
      const normalizedContext = inputKey.contextKey.toLowerCase();
      const epoch = input.hoverCustomEpochByContext.get(normalizedContext) ?? 0;
      return `custom|ctx:${normalizedContext}|${inputKey.wordKey}|e:${epoch}|fp:${inputKey.symbolFingerprint}`;
    }

    const fallbackKey = inputKey.fallbackPath ? input.normalizePathKey(inputKey.fallbackPath) : '__singlefile__';
    const epoch = input.hoverCustomEpochByFallback.get(fallbackKey) ?? 0;
    return `custom|fb:${fallbackKey}|${inputKey.wordKey}|e:${epoch}|fp:${inputKey.symbolFingerprint}`;
  }

  function getHoverFromCacheOrBuild(
    cacheKey: string,
    builder: () => string,
    requestId: string,
    source: 'custom' | 'official'
  ): string
  {
    const cached = input.hoverCache.get(cacheKey);
    if (cached)
    {
      input.sendLog('debug', `hover: cache ${source} hit`, { id: requestId });
      return cached.markdown;
    }
    const markdown = builder();
    input.hoverCache.set(cacheKey, { markdown });
    input.sendLog('debug', `hover: cache ${source} miss`, { id: requestId });
    return markdown;
  }

  function getInternalOriginPrefix(sig: InternalSignatureDoc, requestId?: string): string
  {
    const origin = sig.originSystem;
    if (!origin)
    {
      input.sendLog('warn', `originSystem ausente para assinatura interna name=${sig.name}`, { id: requestId ?? 'n/a' });
      return '[ERRO] ';
    }
    const key = String(origin).toUpperCase();
    if (key === 'SENIOR') return '[Senior] ';
    return `[${key}] `;
  }

  return {
    invalidateHoverCacheOfficial,
    invalidateHoverCacheCustomForContext,
    invalidateHoverCacheCustomForFallback,
    invalidateAllHoverCaches,
    buildOfficialHoverCacheKey,
    buildCustomHoverCacheKey,
    getHoverFromCacheOrBuild,
    getInternalOriginPrefix
  };
}
