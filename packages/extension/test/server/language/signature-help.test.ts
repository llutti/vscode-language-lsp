import { describe, expect, it } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { getSignatureCallContext } from '../../../src/server/language/signature-help';

describe('signature help parser', () =>
{
  it('keeps the active call when arguments contain single-quoted text', () =>
  {
    const doc = TextDocument.create(
      'file:///sig.lsp',
      'lsp',
      1,
      "Mensagem('texto com ) e , dentro', segundo)"
    );

    const offset = doc.getText().indexOf('segundo') + 'segundo'.length;
    const position = doc.positionAt(offset);
    const context = getSignatureCallContext(doc, position);

    expect(context).not.toBeNull();
    expect(context).toEqual({
      name: 'Mensagem',
      activeParameter: 1
    });
  });

  it('counts commas only for the active call frame', () =>
  {
    const doc = TextDocument.create(
      'file:///sig-nested.lsp',
      'lsp',
      1,
      'Externa(Interna(1, 2), 3)'
    );

    const offset = doc.getText().lastIndexOf('3') + 1;
    const position = doc.positionAt(offset);
    const context = getSignatureCallContext(doc, position);

    expect(context).toEqual({
      name: 'Externa',
      activeParameter: 1
    });
  });
});
