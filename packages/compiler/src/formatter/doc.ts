export type Doc =
  | { type: 'text'; value: string }
  | { type: 'line' }
  | { type: 'concat'; parts: Doc[] }
  | { type: 'indent'; content: Doc }
  | { type: 'group'; content: Doc };

export function text(value: string): Doc {
  return { type: 'text', value };
}

export function line(): Doc {
  return { type: 'line' };
}

export function concat(parts: Doc[]): Doc {
  return { type: 'concat', parts };
}

export function indent(content: Doc): Doc {
  return { type: 'indent', content };
}

export function group(content: Doc): Doc {
  return { type: 'group', content };
}
