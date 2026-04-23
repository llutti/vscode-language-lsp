import type { InternalSignatureDoc, SymbolInfo } from '@lsp/compiler';

type AnyParamLabel =
  | string
  | {
    name: string;
    type?: string;
    typeName?: string;
    isReturnValue?: boolean;
    isEnd?: boolean;
  };

function indentMultilineForMarkdown(text: string): string
{
  const normalized = text.replace(/\r\n/g, '\n');
  const parts = normalized.split('\n');
  if (parts.length <= 1) return parts[0] ?? '';
  const [first, ...rest] = parts;
  return first + '\n' + rest.map((line) => '  ' + line).join('\n');
}

export function formatParamLabel(param: AnyParamLabel): string
{
  if (typeof param === 'string') return param.trim();

  const type = (param.type ?? param.typeName ?? '').trim();
  const isEnd = Boolean(param.isReturnValue ?? param.isEnd);
  const end = isEnd ? ' End' : '';
  return `${type}${end} ${param.name}`.trim();
}

function isInternalVariableDoc(
  sig: InternalSignatureDoc
): sig is InternalSignatureDoc & { symbolKind: 'internal'; dataType: string; params?: undefined }
{
  return sig?.symbolKind === 'internal';
}


function getInternalFunctionReturnType(sig: InternalSignatureDoc): string | undefined
{
  const ret = Boolean(sig?.isReturnValue);
  const type = (sig?.dataType ?? '').trim();
  return ret ? type : undefined;
}

export function formatInternalSignatureHover(
  sig: InternalSignatureDoc,
  getOriginPrefix: (sig: InternalSignatureDoc) => string): string
{
  const prefix = getOriginPrefix(sig);
  const signatureLine = isInternalVariableDoc(sig)
    ? `${prefix}Definir ${sig.dataType} ${sig.name};`
    : (() =>
    {
      const params = sig?.params ?? [];
      const returnType = getInternalFunctionReturnType(sig);
      const returnSuffix = returnType ? `: ${returnType}` : '';
      return `${prefix}${sig.name}(${params.map(formatParamLabel).join(', ')})${returnSuffix}`;
    })();

  let text = '```lsp\n' + signatureLine + '\n```';
  if (sig?.documentation)
  {
    text += `\n\n---\n${indentMultilineForMarkdown(sig.documentation)}`;
  }

  if (sig?.docUrl)
  {
    let docVersion = '';
    if (sig?.docVersion)
    {
      docVersion = ` (${sig.docVersion})`;
    }

    text += `\n\n[Documentação oficial${docVersion}](${sig?.docUrl})`;
  }

  return text;
}

export function formatCustomSymbolHover(symbol: SymbolInfo): string
{
  const prefix = '[CUSTOMIZADO] ';

  if (symbol.kind === 'variable')
  {
    if (symbol.typeName === 'Tabela')
    {
      const occurrences = symbol.tableOccurrences ?? 0;
      const columns = symbol.tableColumns ?? [];
      const preview = columns
        .slice(0, 6)
        .map((column) => `${column.typeName} ${column.name}${column.size ? `[${column.size}]` : ''};`)
        .join('\n');
      const lines = [
        `${prefix}Definir Tabela ${symbol.name}[${occurrences}] = {`,
        ...(preview ? [preview] : []),
        ...(columns.length > 6 ? ['...'] : []),
        '};'
      ];
      return `\`\`\`lsp\n${lines.join('\n')}\n\`\`\``;
    }
    return `\`\`\`lsp\n${prefix}Definir ${symbol.typeName} ${symbol.name};\n\`\`\``;
  }

  if (symbol.kind === 'function')
  {
    const params = symbol.params ?? [];
    const label = `${prefix}${symbol.name}(${params.map(formatParamLabel).join(', ')})`;

    return `\`\`\`lsp\n${label}\n\`\`\``;
  }
  return `**${symbol.name}**`;
}
