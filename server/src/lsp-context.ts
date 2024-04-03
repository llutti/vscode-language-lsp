import { Range, TextDocument } from 'vscode-languageserver-textdocument';
import { CancellationToken, CompletionItem, CompletionItemKind, CompletionParams, Definition, Hover, ParameterInformation, Position, SignatureHelp, SignatureInformation, TextDocumentPositionParams } from 'vscode-languageserver/node';
import { LSPClass, LSPSeniorSystems, LSPTemplateClass, LSPTypeObject } from './lsp-elements';

// const tokenSplitter = /([\w\$]+)/g;                     // Captures symbol names
const symbolMatcher = /[\w]+/g;                            // Like above but non-capturing
const firstSymbolMatcher = /(^[\w]+)/;                     // Like above but from start of string only
// const ambientValidator = /(?:^|\(|\[|,)\s*[\w\$]+$/g;   // Matches strings that end with an ambient symbol; fails for sub properties – ...hopefully
const braceMatcher = /{(?:(?!{).)*?}/g;                    // Matches well paired braces
const bracketMatcher = /\[(?:(?!\[).)*?\]/g;               // Matches well paired square brackets
// const matchedParens = /\((?:(?!\().)*?\)/g;             // Matches well paired parentheses

const delimitadores = /[(),./\s]/gi;
const CR = '\r'.charCodeAt(0);
const NL = '\n'.charCodeAt(0);

export class LSPContext
{
  private static _classLookup: { [fullTypeOrUri: string]: LSPClass; } = Object.create(null);
  private static _globalCompletions: CompletionItem[] = [];

  public static async getCompletions(textDocumentPosition: CompletionParams, cancellationToken: CancellationToken, document?: TextDocument, seniorSystemDefault?: LSPSeniorSystems): Promise<CompletionItem[]>
  {
    if (!document)
    {
      return [];
    }

    if (textDocumentPosition.position.character > 4)
    {
      const lineIndex = textDocumentPosition.position.line;
      const charIndex = textDocumentPosition.position.character;
      const start = {
        line: lineIndex,
        character: 0,
      };
      const end = {
        line: lineIndex + 1,
        character: 0,
      };

      const fullLine = document?.getText({ start, end }).trim() || '';
      let line = fullLine.substring(0, charIndex + 1).trim();
      if (this.positionInsideStringLiteral(line))
      {
        return [];
      }

      firstSymbolMatcher.lastIndex = 0;
      const result = firstSymbolMatcher.exec(fullLine.substring(charIndex + 1));
      if (result)
      {
        line += result[1];
      }

      if (line?.toLowerCase()?.startsWith('lst_') === true)
      {
        const metodosLista: CompletionItem[] = [
          { label: 'Adicionar', kind: CompletionItemKind.Method, insertText: 'Adicionar();' },
          {
            label: 'AdicionarCampo',
            documentation: 'Adiciona os campos. Nesta adição também deve ser informado o tipo e o tamanho se necessário.',
            kind: CompletionItemKind.Method,
            detail: 'AdicionarCampo(Alfa NomeCampo, TipoInterno [Alfa|Numero|Data], Numero Tamanho);',
            insertText: 'AdicionarCampo("${1}",${2|Alfa,Data,Numero|});',
            insertTextFormat: 2 // Indica que é SnippetString
          },
          { label: 'Anterior', kind: CompletionItemKind.Method, insertText: 'Anterior();' },
          { label: 'Cancelar', kind: CompletionItemKind.Method, insertText: 'Cancelar();' },
          {
            label: 'Chave',
            kind: CompletionItemKind.Method,
            insertText: 'Chave("${1}");',
            insertTextFormat: 2 // Indica que é SnippetString
          },
          {
            label: 'DefinirCampos',
            documentation: 'Inicia a fase de adição de campos na lista. Somente podem ser adicionado campos durante este período, ou seja, após a chamada deste comando. O mesmo não adiciona nenhuma informação de campos. Isto será feito por um comando que será visto mais tarde.',
            kind: CompletionItemKind.Method,
            insertText: 'DefinirCampos();'
          },
          { label: 'Editar', kind: CompletionItemKind.Method, insertText: 'Editar();' },
          {
            label: 'EditarChave',
            documentation: 'Tem o mesmo objetivo do comando SetarChave mas sem apagar os valores de chave. Quando este comando for chamado os valores que estiverem contidos na chave neste momento serão mantidos e ainda assim a lista entrará em modo de edição de chave.\nServe para procurar por chaves muito parecidas sem que seja necessário informar todos os valores novamente.',
            kind: CompletionItemKind.Method,
            insertText: 'EditarChave();'
          },
          {
            label: 'EfetivarCampos',
            documentation: 'Determinará o fim da adição de campos e informará ao compilador/interpretador que a partir deste ponto a lista será usada efetivamente (receberá valores). Também permitirá ao interpretador criar estruturas internas de controle e manipulação desta lista.',
            kind: CompletionItemKind.Method,
            insertText: 'EfetivarCampos();'
          },
          { label: 'Excluir', kind: CompletionItemKind.Method, insertText: 'Excluir();' },
          { label: 'FDA', kind: CompletionItemKind.Function, insertText: 'FDA' },
          { label: 'Gravar', kind: CompletionItemKind.Method, insertText: 'Gravar();' },
          { label: 'IDA', kind: CompletionItemKind.Function, insertText: 'IDA' },
          { label: 'Inserir', kind: CompletionItemKind.Method, insertText: 'Inserir();' },
          { label: 'Limpar', kind: CompletionItemKind.Method, insertText: 'Limpar();' },
          { label: 'NumReg', kind: CompletionItemKind.Function, insertText: 'NumReg;' },
          { label: 'Primeiro', kind: CompletionItemKind.Method, insertText: 'Primeiro();' },
          { label: 'Proximo', kind: CompletionItemKind.Method, insertText: 'Proximo();' },
          { label: 'QtdRegistros', kind: CompletionItemKind.Function, insertText: 'QtdRegistros;' },
          {
            label: 'SetaNumReg',
            documentation: {
              kind: 'markdown',
              value: 'Este procedimento tem como objetivo posicionar a lista de maneira absoluta. A ordem do registro é influenciado pela chave que estiver ativa no momento da chamada.\n\nA posição da lista é a ordem do registro **menos 1** (*A posição é base Zero*).'
            },
            kind: CompletionItemKind.Method,
            insertText: 'SetaNumReg(${1});',
            insertTextFormat: 2 // Indica que é SnippetString
          },
          {
            label: 'SetarChave',
            documentation: 'Coloca a lista em estado de edição de chave para que seja possível a manipulação dos valores da chave. Quando configurados estes valores, será possível procurar os registro que possuem a chave informada. Isto será feito através do comando VaiParaChave que será visto a seguir.\nApaga os valores que estiverem na chave no momento da chamada. Para manter os valores da chave use o comando EditarChave.',
            kind: CompletionItemKind.Method,
            insertText: 'SetarChave();',
            insertTextFormat: 2 // Indica que é SnippetString
          },
          { label: 'Ultimo', kind: CompletionItemKind.Method, insertText: 'Ultimo();' },
          {
            label: 'VaiParaChave',
            documentation: 'Procura pelo registro que tiver a chave configurada naquele momento. Exemplo: Consideremos que a chave da lista seja o código de cadastro do funcionário e que o mesmo tenha o valor 10 após a chamada do comando SetarChave. Quando o comando VaiParaChave for chamado a lista será posicionada no primeiro registro onde o número do cadastro do funcionário for 10. Se o registro com esta característica não for encontrado, a lista não será reposicionada.\nCaso o comando encontre o registro procurado, será retornado 1. Caso contrário será retornado 0 (zero).',
            kind: CompletionItemKind.Function,
            insertText: 'VaiParaChave()'
          },
        ];

        return metodosLista;
      }
      return [];
    }

    return Object.keys(this._classLookup)
      .filter(
        key =>
        {
          if ((!seniorSystemDefault)
            || (seniorSystemDefault === LSPSeniorSystems.SENIOR))
          {
            return true;
          }

          const classe = this._classLookup[key];

          return [LSPSeniorSystems.SENIOR, LSPSeniorSystems.CUSTOMIZADO, seniorSystemDefault].includes(classe.system);
        })
      .map<CompletionItem>(
        key =>
        {
          const classe = this._classLookup[key];

          return {
            label: classe.label,
            kind: classe.type,
            detail: classe?.signature(),
            documentation: classe?.documentation
          };
        });
  }

  private static ehValidoSistema(systemOfClass: LSPSeniorSystems, seniorSystemDefault?: LSPSeniorSystems): boolean
  {
    if (!seniorSystemDefault)
    {
      return true;
    }

    if (seniorSystemDefault == LSPSeniorSystems.SENIOR)
    {
      return true;
    }

    return [LSPSeniorSystems.SENIOR, LSPSeniorSystems.CUSTOMIZADO, seniorSystemDefault].includes(systemOfClass);
  }

  public static async getSignatureHelp(textDocumentPosition: TextDocumentPositionParams, token: CancellationToken, document?: TextDocument, seniorSystemDefault?: LSPSeniorSystems): Promise<SignatureHelp | null>
  {
    if (!document)
    {
      return null;
    }

    const lineIndex = textDocumentPosition.position.line;
    const start = {
      line: lineIndex,
      character: 0,
    };
    const end = {
      line: lineIndex + 1,
      character: 0,
    };

    let line = document?.getText({ start, end }).substring(0, textDocumentPosition.position.character).trim() || '';
    line = line.replace(braceMatcher, '');
    line = line.replace(bracketMatcher, '');

    let charIndex = line.length - 1;
    let unmatchedParentheses = 1;
    let paramIndex = 0;
    let char: string;

    let inString = false;
    let lookingFor = '';

    while (charIndex >= 0)
    {
      char = line.charAt(charIndex);

      if (inString)
      {
        if ((char === lookingFor)
          && (line.charAt(charIndex - 1) !== '\\'))
        {
          inString = false;
        }
      }
      else
      {
        if (char === '\'' || char === '"')
        {
          inString = true;
          lookingFor = char;
        }
        else
          if (char === '(')
          {
            unmatchedParentheses--;
          }
          else
            if (char === ')')
            {
              unmatchedParentheses++;
            }
            else
              if (unmatchedParentheses === 1 && char === ',')
              {
                paramIndex++;
              }

        if (unmatchedParentheses === 0)
        {
          break;
        }
      }

      charIndex--;
    }

    if (unmatchedParentheses !== 0)
    {
      return null;
    }

    let callOuter = line.substring(0, charIndex).toLowerCase();
    const pos = callOuter.indexOf('=');

    if (pos > 0)
    {
      callOuter = callOuter.substring(pos + 1).trim();
    }

    const funcao = this._classLookup[callOuter];

    if (!funcao)
    {
      return null;
    }

    if (LSPContext.ehValidoSistema(funcao.system, seniorSystemDefault) === false)
    {
      return null;
    }

    const sigParamemterInfos: ParameterInformation[] = [];

    if (funcao.parameters)
    {
      for (const parametro of funcao.parameters)
      {
        sigParamemterInfos.push(
          {
            label: `${parametro.type} ${parametro.isReturnValue ? 'End ' : ''}${parametro.name}`,
            documentation: parametro.documentation
          }
        );
      }
    }

    const sigLabel = funcao.signature();
    const lspSignature: SignatureInformation = {
      label: sigLabel,
      documentation: funcao?.documentation,
      parameters: sigParamemterInfos
    };

    return {
      signatures: [lspSignature],
      activeSignature: 0,
      activeParameter: paramIndex
    };
  }

  public static async getDefinitionPosition(textDocumentPosition: TextDocumentPositionParams, document?: TextDocument): Promise<Definition | null>
  {
    if (!document)
    {
      return null;
    }

    const position = textDocumentPosition.position;
    const lineIndex = position.line;
    const charIndex = position.character;
    const start = {
      line: lineIndex,
      character: 0,
    };
    const end = {
      line: lineIndex + 1,
      character: 0,
    };

    const fullLine = document.getText({ start, end });
    if (!fullLine.charAt(charIndex).match(symbolMatcher))
    {
      return null;
    }

    const index = document.offsetAt(position) - document.offsetAt(start);
    const identificador = LSPContext.getWordAtText(fullLine, index);

    const line = fullLine.substring(0, charIndex + 1).trim();

    if (this.positionInsideStringLiteral(line))
    {
      return null;
    }

    const funcao = this._classLookup[identificador.word];

    if (!funcao)
    {
      return null;
    }

    if ((funcao.system !== LSPSeniorSystems.CUSTOMIZADO)
      || (funcao.type !== LSPTypeObject.Method))
    {
      return null;
    }

    if (!funcao?.position)
    {
      return null;
    }

    const result = {
      uri: funcao.fileUri,
      range: {
        start: {
          line: funcao.position.line,
          character: funcao.position.character
        },
        end: {
          line: funcao.position.line,
          character: funcao.position.character
        },
      },
    } satisfies Definition;

    return result;
  }

  public static async getHoverInfo(position: Position, document?: TextDocument, seniorSystemDefault?: LSPSeniorSystems): Promise<Hover | null>
  {
    try
    {
      if (!document)
      {
        return null;
      }

      const lineIndex = position.line;
      const charIndex = position.character;
      const start = {
        line: lineIndex,
        character: 0,
      };
      const end = {
        line: lineIndex + 1,
        character: 0,
      };

      const fullLine = document.getText({ start, end });
      if (!fullLine.charAt(charIndex).match(symbolMatcher))
      {
        return null;
      }

      const index = document.offsetAt(position) - document.offsetAt(start);
      const identificador = LSPContext.getWordAtText(fullLine, index);

      const line = fullLine.substring(0, charIndex + 1).trim();
      if (this.positionInsideStringLiteral(line))
      {
        return null;
      }

      const classe = this._classLookup[identificador.word];
      if (!classe)
      {
        return null;
      }

      if (LSPContext.ehValidoSistema(classe.system, seniorSystemDefault) === false)
      {
        return null;
      }

      let hoverContents = `\`\`\`lsp\n${classe.signature()}\n\`\`\``;
      if (classe?.documentation)
      {
        hoverContents = hoverContents + '\n---\n';
        if (typeof classe.documentation !== 'string')
        {
          hoverContents = hoverContents + classe.documentation.value;
        }
        else
        {
          hoverContents = hoverContents + classe.documentation?.toString();
        }
      }

      if (classe?.link)
      {
        hoverContents = hoverContents + `\n\n[Documentação Oficial](${classe.link})`;
      }

      const range: Range = {
        start: {
          line: lineIndex,
          character: identificador.start
        },
        end: {
          line: lineIndex,
          character: identificador.start + identificador.length
        }
      };

      return {
        contents: hoverContents,
        range
      };
    }
    catch (error)
    {
      return { contents: 'CATCH:' + error };
    }

  }

  public static isCustomFunction(token: string): boolean
  {
    if (!token)
    {
      return false;
    }

    const classe = this._classLookup[token.toLowerCase()];

    if (!classe)
    {
      return false;
    }

    // console.log(token, classe, (classe?.system === LSPSeniorSystems.CUSTOMIZADO) && (classe?.type === LSPTypeObject.Method));

    return (classe?.system === LSPSeniorSystems.CUSTOMIZADO) && (classe?.type === LSPTypeObject.Method);
  }

  public static registerClasses(fileUri: string, classes: LSPClass[]): void
  {
    const newClassLookup: { [fullTypeOrUri: string]: LSPClass; } = {}; // Object.create(null);
    Object
      .keys(this._classLookup)
      .forEach(
        c =>
        {
          if (this._classLookup[c].fileUri !== fileUri)
          {
            newClassLookup[c] = this._classLookup[c];
          }
        }
      );
    this._classLookup = { ...newClassLookup };
    classes.map(classe => this.registerClass(classe));
  }

  public static registerClass(lspClass: LSPClass): void
  {
    if (!lspClass.name)
    {
      return;
    }

    this._classLookup[lspClass.name] = lspClass;
    // this._classLookup[lspClass.fileUri] = lspClass;
  }

  public static loadInternalTemplates(templates: LSPTemplateClass[]): void
  {
    templates.forEach(template =>
    {
      const lspClass = LSPClass.fromTemplate(template);

      this.registerClass(lspClass);

      this._globalCompletions.push({
        label: lspClass.label,
        detail: lspClass.signature(),
        kind: lspClass.type
      });
    });
  }

  private static isNewlineCharacter(charCode: number)
  {
    return charCode === CR || charCode === NL;
  }

  private static getWordAtText(text: string, offset: number): { word: string; start: number; length: number; }
  {
    let textStart = offset;
    while (textStart > 0 && !LSPContext.isNewlineCharacter(text.charCodeAt(textStart - 1)) && !delimitadores.test(text[textStart - 1]))
    {
      textStart--;
    }

    let textEnd = offset;
    while (!LSPContext.isNewlineCharacter(text.charCodeAt(textEnd + 1)) && !delimitadores.test(text[textEnd + 1]))
    {
      textEnd++;
    }

    const len = textEnd - textStart + 1; // +1 pois eh base zero
    const word = text.substr(textStart, len)?.toLowerCase();

    return { word, start: textStart, length: len };
  }

  private static positionInsideStringLiteral(line: string, position?: number): boolean
  {
    position = position || line.length;
    let inString = false;
    let char: string;
    let lookingFor = '';
    for (let i = 0; i < position; i++)
    {
      char = line.charAt(i);
      if (inString)
      {
        if (char === lookingFor)
        {
          inString = false;
        }
        else
          if (char === '\\')
          {
            i++;
          }
      }
      else
        if (char === '\'' || char === '"')
        {
          inString = true;
          lookingFor = char;
        }
    }
    return inString;
  }
}