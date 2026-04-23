import { casefold } from '../../utils/casefold';

export type CursorMethodSpec = {
  name: string;
  minArgs: number;
  maxArgs: number;
  documentation?: string;
  detail?: string;
  insertText?: string;
  insertTextFormat?: 1 | 2;
};

export const CURSOR_METHODS: CursorMethodSpec[] = [
  {
    name: 'AbrirCursor',
    minArgs: 0,
    maxArgs: 0
  },
  {
    name: 'FecharCursor',
    minArgs: 0,
    maxArgs: 0
  },
  {
    name: 'Proximo',
    minArgs: 0,
    maxArgs: 0
  },
  {
    name: 'Achou',
    minArgs: 0,
    maxArgs: 0
  },
  {
    name: 'NaoAchou',
    minArgs: 0,
    maxArgs: 0
  },
  {
    name: 'UsaAbrangencia',
    minArgs: 1,
    maxArgs: 1,
    documentation: 'Coloca a abrangência de usuário automaticamente ao abrir o cursor. Se for passado o valor <b>“1”</b> a abrangência será setada, caso contrário a mesma não será setada',
    detail: 'UsaAbrangencia(Numero abrangencia)'
  },
];

const CURSOR_METHODS_BY_NAME = new Map(
  CURSOR_METHODS.map((method) => [casefold(method.name), method])
);

export function getCursorMethodSpec(name: string): CursorMethodSpec | undefined
{
  return CURSOR_METHODS_BY_NAME.get(casefold(name));
}

export function getCursorMethodNames(): string[]
{
  return CURSOR_METHODS.map((method) => method.name);
}
