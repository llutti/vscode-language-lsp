import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('contexts wizard ux', () => {
  it('offers context templates and preview guidance before save', () => {
    const extensionPath = path.join(__dirname, '..', '..', '..', 'src', 'extension.ts');
    const source = fs.readFileSync(extensionPath, 'utf8');

    expect(source.includes('Template inicial do contexto (recomendado)')).toBe(true);
    expect(source.includes('[contexts][wizard] preview')).toBe(true);
    expect(source.includes('Pré-visualização:')).toBe(true);
    expect(source.includes('Salvar contexto')).toBe(true);
    expect(source.includes('CONTEXT_FILE_CONFLICT')).toBe(true);
    expect(source.includes('sobreposição de arquivos')).toBe(true);
  });
});
