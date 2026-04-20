import { CompletionItemKind, InsertTextFormat, type CompletionItem } from 'vscode-languageserver/node';
import type { ListaMethod, ListaProperty } from '@lsp/compiler';

export function completionItem(kind: CompletionItemKind | number, label: string, insertText?: string): CompletionItem
{
  return {
    label,
    kind: kind as CompletionItemKind,
    insertText: insertText ?? label
  };
}

export function snippetItem(label: string, snippet: string, detail?: string): CompletionItem
{
  return {
    label,
    kind: 15,
    insertText: snippet,
    insertTextFormat: InsertTextFormat.Snippet,
    detail
  };
}

export function listaMethodCompletionItem(method: ListaMethod): CompletionItem
{
  const item: CompletionItem = {
    label: method.name,
    kind: CompletionItemKind.Method,
    insertText: method.insertText ?? method.name,
    detail: method.detail,
    documentation: method.documentation
  };
  if (method.insertTextFormat === InsertTextFormat.Snippet)
  {
    item.insertTextFormat = InsertTextFormat.Snippet;
  }
  return item;
}

export function listaPropertyCompletionItem(property: ListaProperty): CompletionItem
{
  return {
    label: property.name,
    kind: CompletionItemKind.Property,
    insertText: property.name,
    detail: property.detail,
    documentation: property.documentation
  };
}
