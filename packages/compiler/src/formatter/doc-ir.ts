export type Doc =
  | { type: 'text'; value: string }
  | { type: 'line' }
  | { type: 'softline' }
  | { type: 'hardline' }
  | { type: 'group'; content: Doc }
  | { type: 'indent'; content: Doc }
  | { type: 'concat'; parts: Doc[] }
  | { type: 'ifBreak'; breakDoc: Doc; flatDoc: Doc };

export function text(value: string): Doc {
  return { type: 'text', value };
}

export function line(): Doc {
  return { type: 'line' };
}

export function softline(): Doc {
  return { type: 'softline' };
}

export function hardline(): Doc {
  return { type: 'hardline' };
}

export function group(content: Doc): Doc {
  return { type: 'group', content };
}

export function indent(content: Doc): Doc {
  return { type: 'indent', content };
}

export function concat(parts: Doc[]): Doc {
  return { type: 'concat', parts };
}

export function ifBreak(breakDoc: Doc, flatDoc: Doc): Doc {
  return { type: 'ifBreak', breakDoc, flatDoc };
}
