import type { Doc } from './doc';

export type RenderOptions = {
  indentUnit: string;
  eol: '\n' | '\r\n';
};

export function render(doc: Doc, options: RenderOptions): string {
  const out: string[] = [];
  let level = 0;
  let atLineStart = true;

  const write = (s: string) => {
    if (s.length) out.push(s);
  };

  const renderNode = (node: Doc) => {
    switch (node.type) {
      case 'text':
        if (atLineStart && level > 0) {
          write(options.indentUnit.repeat(level));
        }
        write(node.value);
        atLineStart = false;
        return;
      case 'line':
        write(options.eol);
        atLineStart = true;
        return;
      case 'concat':
        for (const part of node.parts) renderNode(part);
        return;
      case 'group':
        // Nível B (sem wrap): group é no-op.
        renderNode(node.content);
        return;
      case 'indent':
        level += 1;
        renderNode(node.content);
        level -= 1;
        return;
    }
  };

  renderNode(doc);
  return out.join('');
}
