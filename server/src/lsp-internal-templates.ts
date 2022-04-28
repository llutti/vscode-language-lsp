import { EParameterType, LSPTemplateClass, LSPTypeObject } from './lsp-elements';

export const templatesInternos: LSPTemplateClass[] = [
  {
    label: "cVerdadeiro",
    documentation: 'Constante que representa o valor "1"',
    type: LSPTypeObject.Constant
  },
  {
    label: "cFalso",
    documentation: 'Constante que representa o valor "0"',
    type: LSPTypeObject.Constant
  },
  {
    label: "AlfaParaInt",
    documentation: "Converte um texto para um número não formatado",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Origem",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Retorno",
        isReturnValue: true
      }
    ]
  },
  {
    label: "ConverteMascara",
    type: LSPTypeObject.Method,
    documentation: 'Esta função converte um valor de entrada (numérico, data, hora ou cadeia de caracteres), para o tipo de dado cadeia de caracteres.',
    parameters: [
      {
        type: EParameterType.Numero,
        name: "TipoDado",
        documentation: '1:Número | 2:Dinheiro(valor) | 3:Data | 4:Hora | 5:Alfa',
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "ValorNum",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "ValorStr",
        isReturnValue: true
      },
      {
        type: EParameterType.Alfa,
        name: "Mascara",
        documentation:
        {
          kind: 'markdown',
          value: 'Para pesquisar os valores válidos, acessar a [documentação da Senior](https://documentacao.senior.com.br/tecnologia/6.2.35/index.htm#cbds/mascara.htm)'
        },
        isReturnValue: false
      }
    ]
  },
  {
    label: "MontaData",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "Dia",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Mes",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Ano",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Retorno",
        isReturnValue: true
      }
    ]
  },
  {
    label: "IntParaAlfa",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "Origem",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Retorno",
        isReturnValue: true
      }
    ]
  },
  {
    label: "WInsSelecaodaLista",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "HTML",
        isReturnValue: true
      },
      {
        type: EParameterType.Alfa,
        name: "Marcador",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "NomeLista",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Opcional",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "ItemSelecionado",
        isReturnValue: false
      }
    ]
  },
  {
    label: "WInsSelecaodoBanco",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "HTML",
        isReturnValue: true
      },
      {
        type: EParameterType.Alfa,
        name: "Marcador",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "SQL",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "CampoValor",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "CampoDescricao",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Opcional",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "ItemSelecionado",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipoSQL",
        isReturnValue: false
      }
    ]
  },
  {
    label: "WAdicionanoHTML",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aValor",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aHTML",
        isReturnValue: true
      },
      {
        type: EParameterType.Alfa,
        name: "aMarcador",
        isReturnValue: false
      }
    ]
  },
  {
    label: "WAdicionaListaErros",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aCampo",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aMsgErro",
        isReturnValue: false
      }
    ]
  },
  {
    label: "TrocaString",
    type: LSPTypeObject.Method,
    documentation: 'Procura por um trecho específico dentro de um texto e o substitui, retornando um novo texto.',
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "TextoInicial",
        documentation: 'Texto original',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "TextoPesquisar",
        documentation: 'Trecho específico que deve ser buscado no texto original',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "NovoTexto",
        documentation: 'Texto que irá substituir o trecho específico buscado',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Retorno",
        documentation: 'Variável que irá receber o novo texto retornado pela função',
        isReturnValue: true
      }
    ]
  },
  {
    label: "DescItemLista",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "NomLis",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "IteLis",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "DesLis",
        isReturnValue: true
      }
    ]
  },
  {
    label: "DesmontaData",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Data,
        name: "DataOrigem",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Dia",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Mes",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Ano",
        isReturnValue: false
      }
    ]
  },
  {
    label: "ConverteDataBanco",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Data,
        name: "DataOrigem",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "DataDestino",
        isReturnValue: true
      }
    ]
  },
  {
    label: "ConverteMinutosHoras",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "QuantidadeMinutos",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "RetornoHoras",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetornaEscala",
    documentation: "Retorna a escala do colaborador em determinada data, considerando as programações de troca de escala e histórico do colaborador",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "Data",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "CodEsc",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "CodTma",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "TurInt",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "CodEqp",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "CodCat",
        isReturnValue: true
      },
      {
        type: EParameterType.Alfa,
        name: "Mensagem",
        isReturnValue: true
      }
    ]
  },
  {
    label: "RetSalDat",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Saldo",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "Data",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "ValSaldo",
        isReturnValue: false
      }
    ]
  },
  {
    label: "LiquidoFolha",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NatEve",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "ConSol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Liquido",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "PerPag",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatPag",
        isReturnValue: false
      }
    ]
  },
  {
    label: "LiquidoFerias",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatIni",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatFim",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NatEve",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Liquido",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "PerPag",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatPag",
        isReturnValue: false
      }
    ]
  },
  {
    label: "LiquidoRescisao",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatIni",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatFim",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipRcs",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NatEve",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Liquido",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "PerPag",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatPag",
        isReturnValue: false
      }
    ]
  },
  {
    label: "WCheckValInteger",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Campo",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Descricao",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Retorno",
        isReturnValue: true
      },
      {
        type: EParameterType.Alfa,
        name: "Opcional",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TamMax",
        documentation: 'Tamanho Máximo',
        isReturnValue: false
      }
    ]
  },
  {
    label: "WCheckValString",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Campo",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Descricao",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Retorno",
        isReturnValue: true
      },
      {
        type: EParameterType.Alfa,
        name: "Opcional",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TamMax",
        documentation: 'Tamanho Máximo',
        isReturnValue: false
      }
    ]
  },
  {
    label: "WCheckValData",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Campo",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Descricao",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Retorno",
        isReturnValue: true
      },
      {
        type: EParameterType.Alfa,
        name: "Opcional",
        isReturnValue: false
      }
    ]
  },
  {
    label: "WCheckValHora",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Campo",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Descricao",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Retorno",
        isReturnValue: true
      },
      {
        type: EParameterType.Alfa,
        name: "Opcional",
        isReturnValue: false
      }
    ]
  },
  {
    label: "WCheckValCheckBox",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Campo",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Descricao",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Retorno",
        isReturnValue: true
      }
    ]
  },
  {
    label: "WLerHTML",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "NomeArquivo",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "HTML",
        isReturnValue: true
      }
    ]
  },
  {
    label: "RetColabPorCodUsu",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "CodUsu",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: true
      }
    ]
  },
  {
    label: "WCountFields",
    type: LSPTypeObject.Method,
    documentation: 'Retorna a quantidade de campos passados pela ação do HTML',
    parameters: [
      {
        type: EParameterType.Numero,
        name: "QtdCampos",
        isReturnValue: true
      }
    ]
  },
  {
    label: "WReturnFieldsName",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "Indice",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "NomeCampo",
        isReturnValue: true
      }
    ]
  },
  {
    label: "CopiarAlfa",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Texto",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "PosicaoInicial",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "QuantidadeCaracteres",
        isReturnValue: false
      }
    ]
  },
  {
    label: "DeletarAlfa",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "Variavel",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Posicao",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Quantidade",
        isReturnValue: false
      }
    ]
  },
  {
    label: "LerPosicaoAlfa",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "Origem",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Destino",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Posicao",
        isReturnValue: false
      }
    ]
  },
  {
    label: "PosicaoAlfa",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "TextoPesquisar",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "ValorPesquisado",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Posicao",
        isReturnValue: true
      }
    ]
  },
  {
    label: "TamanhoAlfa",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Origem",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Tamanho",
        isReturnValue: true
      }
    ]
  },
  {
    label: "RetornaHorario",
    type: LSPTypeObject.Method,
    documentation: 'A função Retornahorario calcula o horário na hora em que é chamada, considerando as programações de troca de horário, escala e ponte. Na escala de Busca Automática retorna o horário base e não o horário apurado.',
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "Data",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "ConsiderarFeriado",
        documentation: 'Indica se é para retornar se é feriado ou não. Valores possíveis "S" | "N"',
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "CodHor",
        isReturnValue: true
      }
    ]
  },
  {
    label: "ExtensoSemana",
    type: LSPTypeObject.Method,
    documentation: 'Esta função monta o extenso do dia da semana de uma determinada data.',
    parameters: [
      {
        type: EParameterType.Data,
        name: "Data",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Retorno",
        documentation: 'Variável tipo Alfa que receberá o extenso do dia da semana.',
        isReturnValue: true
      }
    ]
  },
  {
    label: "RetornaEscala",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "Data",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Escala",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Turma",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Intervalo",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Mensagem",
        isReturnValue: false
      }
    ]
  },
  {
    label: "Para",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "valor inicial",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "condição",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "contador",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetDifDat",
    documentation: "Esta função retorna a diferença em dias, meses ou anos entre duas datas.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "UnidadeRetorno",
        documentation: {
          kind: 'markdown',
          value: 'Tipo de retorno desejado, podendo ser:\n'
            + '- 1 - Quantidade de dias\n'
            + '- 2 - Quantidade de meses\n'
            + '- 3 - Quantidade de anos\n'
            + '- 4 - Quantidade de meses com ajuste\n'
            + '- 5 - Quantidade de anos com ajuste\n'
            + '- 6 - Quantidade de meses com ajuste pelas datas início e fim'
        },
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "DataIni",
        documentation: 'Data Inicial',
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "DataFim",
        documentation: 'Data Final',
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Retorno",
        documentation: 'Variável que irá receber o valor calculado',
        isReturnValue: true
      }
    ]
  },
  {
    label: "RestoDivisao",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "Dividendo",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Divisor",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Resto",
        isReturnValue: true
      }
    ]
  },
  {
    label: "Divide",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "Divisor",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Dividendo",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipoDivisao",
        documentation: '1-Normal|2-Resto|3-Parte inteira da divisão',
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Retorno",
        isReturnValue: true
      }
    ]
  },
  {
    label: "TruncarValor",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "Valor",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetHtmlFicReg",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "Pasta",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "vHtml",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "Alt",
        isReturnValue: true
      }
    ]
  },
  {
    label: "WStrtoJavaScript",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Origem",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Retorno",
        isReturnValue: true
      }
    ]
  },
  {
    label: "TiraEspacos",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "ValorInicial",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Retorno",
        isReturnValue: true
      }
    ]
  },
  {
    label: "ConverteParaMaiusculo",
    type: LSPTypeObject.Method,
    documentation: 'Converte o conteúdo de uma variável do tipo Alfa para maiúsculo.',
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "TextoConverter",
        documentation: 'Variável de entrada com o conteúdo que será convertido para maiúsculo.',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "TextoConvertido",
        documentation: 'Variável de saída que receberá o conteúdo convertido.',
        isReturnValue: true
      }
    ]
  },
  {
    label: "ConverteParaMinusculo",
    type: LSPTypeObject.Method,
    documentation: 'Converte o conteúdo de uma variável do tipo Alfa para minúsculo.',
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "TextoConverter",
        documentation: 'Variável de entrada com o conteúdo que será convertido para minúsculo.',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "TextoConvertido",
        documentation: 'Variável de saída que receberá o conteúdo convertido.',
        isReturnValue: true
      }
    ]
  },
  {
    label: "WAlteraValorCampo",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aNomeValor",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aValorCampo",
        isReturnValue: false
      }
    ]
  },
  {
    label: "MontaAbrangencia",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "pCpoTab",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "pAbgInf",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "pAbrRetorno",
        isReturnValue: false
      }
    ]
  },
  {
    label: "__Inserir",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Nome_Variavel",
        isReturnValue: false
      }
    ]
  },
  {
    label: "WCheckValDouble",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aCampo",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aDescricao",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "aRetorno",
        isReturnValue: true
      },
      {
        type: EParameterType.Alfa,
        name: "aOpcional",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "aTamMax",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetQtdVagLoc",
    type: LSPTypeObject.Method,
    documentation: 'A função RetQtdVagLoc tem como objetivo retornar a quantidade de vagas disponíveis em um determinado local, cargo e data passados como parâmetros, ou seja, é a diferença entre a quantidade de vagas do quadro previsto e a quantidade de vagas do quadro efetivo.',
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TabOrg",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumLoc",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "EstCar",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "CodCar",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Turno",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatAlt",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "QtdVaga",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "TipVag",
        documentation: 'Quando a empresa utiliza o tipo de vaga deve informar qual o tipo de vaga que deseja consultar, senão deve informar um parâmetro default igual a 1.',
        isReturnValue: false
      }
    ]
  },
  {
    label: "BusCadChefe",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatBas",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Nivel",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "ExcecaoChefia",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "EmpChe",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "TipChe",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "CadChe",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "LocChe",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "LocCol",
        isReturnValue: false
      }
    ]
  },
  {
    label: "EnviaEMail",
    documentation: "Função que permite enviar e-mails. (CodErroEnviaEmail e MsgErroEnviaEmail)",
    type: LSPTypeObject.Function,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Rememetente",
        documentation: 'Endereço Eletrônico do Remetente do e-mail.',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Destinatario",
        documentation: 'Endereço Eletrônico do Destinatário do e-mail. Parâmetro obrigatório. Se houver mais de um, devem ser separados por ponto e vírgula (;).',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "CopiaPara",
        documentation: 'Endereço Eletrônico do Destinatário da cópia do e-mail. Se houver mais de um, devem ser separados por ponto e vírgula (;).',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "CopiaOcultaPara",
        documentation: 'Endereço Eletrônico do Destinatário da cópia oculta do e-mail. Se houver mais de um, devem ser separados por ponto e vírgula (;).',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Assunto",
        documentation: 'Assunto do e-mail.',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Texto",
        documentation: 'Texto do e-mail.',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Anexos",
        documentation: 'Caminho completo dos arquivos anexos do e-mail. Se houver mais de um, devem ser separados por ponto e vírgula (;).',
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "PapelCarta",
        documentation: 'Indica se será utilizado o texto de papel de carta. Valores: 0 (Não) e 1 (Sim).',
        isReturnValue: false
      }
    ]
  },
  {
    label: "EnviaEMailHTML",
    documentation: "Função que permite enviar e-mails em formato HTML e com imagens no corpo do E-mail. (CodErroEnviaEmail e MsgErroEnviaEmail)",
    type: LSPTypeObject.Function,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Rememetente",
        documentation: 'Endereço Eletrônico do Remetente do e-mail.',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Destinatario",
        documentation: 'Endereço Eletrônico do Destinatário do e-mail. Parâmetro obrigatório. Se houver mais de um, devem ser separados por ponto e vírgula (;).',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "CopiaPara",
        documentation: 'Endereço Eletrônico do Destinatário da cópia do e-mail. Se houver mais de um, devem ser separados por ponto e vírgula (;).',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "CopiaOcultaPara",
        documentation: 'Endereço Eletrônico do Destinatário da cópia oculta do e-mail. Se houver mais de um, devem ser separados por ponto e vírgula (;).',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Assunto",
        documentation: 'Assunto do e-mail.',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Texto",
        documentation: 'Texto do e-mail.',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Anexos",
        documentation: 'Caminho completo dos arquivos anexos do e-mail. Se houver mais de um, devem ser separados por ponto e vírgula (;).',
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TratarAnexo",
        documentation: {
          kind: 'markdown',
          value: 'Indicar o código de qual tratamento deve ser dado às imagens do email, podendo ser:'
            + '  - **HimEmbeded**: Os links apontam para figuras que seguem anexas à mensagem e são exibidas em seu corpo. **Atenção**: esta opção possui uma limitação: não podem existir duas imagens com o mesmo nome de arquivo, pois a imagem vai em anexo implicitamente. Portanto, se existirem duas imagens com o mesmo nome de arquivo, a exibição poderá apresentar problemas.'
            + '  - **HimLink**: Os links indicam imagens externas à mensagem, não recebendo nenhum tipo de tratamento. *Exemplo*: <IMG SRC="http://www.senior.com.br/figuras/senior.gif">'
            + '  - **HimAttach**: Os links apontam para figuras que seguem anexas à mensagem, mas não são exibidas no corpo da mensagem e sim na lista de arquivos anexos.'
        },
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "PapelCarta",
        documentation: 'Indica se será utilizado o texto de papel de carta. Valores: 0 (Não) e 1 (Sim).',
        isReturnValue: false
      }
    ]
  },
  {
    label: "BusEmailFunc",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "EmailParticular",
        isReturnValue: true
      },
      {
        type: EParameterType.Alfa,
        name: "EmailComercial",
        isReturnValue: true
      }
    ]
  },
  {
    label: "RetornaBatidaHorario",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "CodHor",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "SeqMar",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "UsoMar",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "HorMar",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "TolAnt",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "TolApo",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "FaiMov",
        isReturnValue: true
      }
    ]
  },
  {
    label: "ExtrasIntervalo",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "horaini",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "horafim",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "diaext",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "qtddiu",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "qtdnot",
        isReturnValue: true
      }
    ]
  },
  {
    label: "RetMinRefHTr",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "QtdeMinutos",
        isReturnValue: true
      }
    ]
  },
  {
    label: "RetVinEmp",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DataRef",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetornaCodLoc",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumLoc",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "CodLoc",
        isReturnValue: true
      }
    ]
  },
  {
    label: "RetTurCol",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Data,
        name: "Data",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Turno",
        isReturnValue: true
      }
    ]
  },
  {
    label: "InsClauSQLWhere",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "SectionName",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "WhereClau",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetornaHorarioApurado",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "Data",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "CodHor",
        isReturnValue: true
      },
      {
        type: EParameterType.Alfa,
        name: "Mensagem",
        isReturnValue: true
      }
    ]
  },
  {
    label: "DataHoje",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Data,
        name: "Retorno",
        isReturnValue: true
      }
    ]
  },
  {
    label: "RetornaAnoData",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Data,
        name: "DataBase",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Ano",
        isReturnValue: true
      }
    ]
  },
  {
    label: "RetornaMesData",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Data,
        name: "DataBase",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Mes",
        isReturnValue: true
      }
    ]
  },
  {
    label: "RetornaDiaData",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Data,
        name: "DataBase",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Dia",
        isReturnValue: true
      }
    ]
  },
  {
    label: "AlteraControle",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Nome_Controle",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Nome_Propriedade",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Valor_Propriedade",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetornaDiaSemana",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Data,
        name: "DataBase",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Retorno",
        isReturnValue: true
      }
    ]
  },
  {
    label: "AdicionarCampo",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "NomeCampo",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Tipo_Campo",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Tamanho",
        isReturnValue: false
      }
    ]
  },
  {
    label: "Chave",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Nome_Campo [;Nome_Campo[;Nome_Campo]...]",
        isReturnValue: false
      }
    ]
  },
  {
    label: "VerDatFer",
    documentation: "Procura se a data específica é um feriado para o colaborador. Para isto, verifica pela filial e pela escala. Se a data for feriado,  retornará 1. Caso contrário, retornará 0.",
    type: LSPTypeObject.Function,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "Data",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetNivLoc",
    documentation: "Função que retorna a quantidade de níveis do local informado",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "TabOrg",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "CodLoc",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatLoc",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Nivloc",
        isReturnValue: true
      }
    ]
  },
  {
    label: "Concatena",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "Texto1",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Texto2",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Texto3",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Destino",
        isReturnValue: false
      }
    ]
  },
  {
    label: "ArredondarValor",
    documentation: "Esta função arredonda determinado valor, conforme a quantidade de casa decimais informada",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "ValorVariavel",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "Precisao",
        isReturnValue: false
      }
    ]
  },
  {
    label: "InicioVtr",
    documentation: "Função para preparar os recursos de máquina (alocar memória) para o cálculo de Vale Transporte",
    type: LSPTypeObject.Method
  },
  {
    label: "VerFaltasVtr",
    documentation: "Verificar se o colaborador teve faltas no período para perda de vale transporte",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "PerIni",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "PerFim",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "SolIni",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "SolFim",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "IniFal",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "FimFal",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TemFal",
        isReturnValue: true
      }
    ]
  },
  {
    label: "LerPassesVtr",
    documentation: "Verifica se houve digitação de Passes de Vale Transporte",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "PerIni",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "PerFim",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TemDig",
        isReturnValue: true
      }
    ]
  },
  {
    label: "CalcularVtr",
    documentation: "Esta função calcula o valor e a quantidade de passes de vale transporte",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Tipcol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "PerIni",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "PerFim",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "RecCal",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "SolIni",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "SolFim",
        isReturnValue: false
      }
    ]
  },
  {
    label: "GravarVtr",
    documentation: "Grava os passes na tabela R028PVT, calculada anteriormente pela função CalculaVtr",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Tipcol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "PerIni",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "PerFim",
        isReturnValue: false
      }
    ]
  },
  {
    label: "FinalVtr",
    documentation: "Libera as estruturas alocadas anteriormente pela função CalculaVtr",
    type: LSPTypeObject.Method
  },
  {
    label: "ListaSecao",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "SectionName",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetEscEmp",
    documentation: "Retorna a escala do funcionário em uma determinada data",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatEsc",
        isReturnValue: false
      }
    ]
  },
  {
    label: "VerAbrBHR",
    documentation: "Esta função verifica se o colaborador está incluído na abrangência de um determinado banco de horas",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "CodBhr",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatBus",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "ColBhr",
        isReturnValue: true
      }
    ]
  },
  {
    label: "WWriteCookie",
    documentation: "Grava um campo no Cookie ativo",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Nome",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Valor",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetSinEmp",
    documentation: "Esta função retorna o código do sindicato de um colaborador em uma determinada data na variável de sistema CodSinEmp",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DataRef",
        isReturnValue: false
      }
    ]
  },
  {
    label: "CalIdaEmp",
    documentation: "cula a idade do colaborador na Data de Referência",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatRef",
        isReturnValue: false
      }
    ]
  },
  {
    label: "CalculaQtdMinutos",
    documentation: "Calcula a quantidade de minutos existente entre uma Data/Hora Inicial e uma Data/Hora Final",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Data,
        name: "DatIni",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Hora HorIni",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "DatFim",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Hora Horfim",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Qtd_Minutos",
        isReturnValue: true
      }
    ]
  },
  {
    label: "RetornaNumLoc",
    documentation: "Converte o código do local para o número do local. Considera a data setada em DatRef",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "TabOrg",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "pCodLoc",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetornaNivelLocal",
    documentation: "Retorna uma fração do código do local do nível inicial até o nível final informados",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "TabOrg",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "CodLoc",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NivIni",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NivFim",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "NivLoc",
        isReturnValue: true
      }
    ]
  },
  {
    label: "RetornaAscII",
    documentation: "Esta função retorna o caractere ASCII de um número.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "CodigoASCII",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Retorno",
        isReturnValue: true
      }
    ]
  },
  {
    label: "PertenceGrupo",
    documentation: "Identifica se o usuário ativo pertence ao grupo de usuários passado como parâmetro. Se pertencer retornará 1, caso contrário retornará 0",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "NomGru",
        isReturnValue: false
      }
    ]
  },
  {
    label: "WSetarCalculo",
    documentation: "Função utilizada para setar o código de cálculo para processos automáticos, via regra (Somente RubiWeb)",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "CodCal",
        isReturnValue: false
      }
    ]
  },
  {
    label: "UltimoDia",
    documentation: "Esta função verifica qual é o último dia do mês/ano da data informada, retornando esta nova data dia/mês/ano na própria variável indicada",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Data,
        name: "Mes",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetLocEmp",
    documentation: "Retorna o local do funcionário em uma determinada data.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatLoc",
        isReturnValue: false
      }
    ]
  },
  {
    label: "WSQLSenior2paraSQLNativo",
    documentation: "Retorna a Sintaxe de um comando SQL Senior2 para o SQL Nativo, correspondente ao banco que estiver sendo utilizado",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "SqlSenior2",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "SqlNativo",
        isReturnValue: true
      }
    ]
  },
  {
    label: "CalculaTotCol",
    documentation: "Esta função calcula o totalizador do evento, valor ou referência, de acordo com o cálculo, totalizador e o colaborador enviados por parâmetro.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "xCodCal",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "CodTot",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Retorna",
        isReturnValue: true
      }
    ]
  },
  {
    label: "SelectData",
    documentation: "Função na qual é possível executar qualquer SELECT",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "SQL",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "CamposRet",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "TemDados",
        isReturnValue: true
      }
    ]
  },
  {
    label: "RetCampoNumero",
    documentation: "Para buscar algum campo retornado das funções SelectData e SelectMaskedData",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "Indice",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Campos",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Retorno",
        isReturnValue: true
      }
    ]
  },
  {
    label: "RetCampoAlfa",
    documentation: "Para buscar algum campo retornado das funções SelectData e SelectMaskedData",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "Indice",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Campos",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Retorno",
        isReturnValue: true
      }
    ]
  },
  {
    label: "RetSitEmp",
    documentation: "Retorna a Situação do Colaborador em uma determinda Data (Retorna na variável SitEmp)",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "xNumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "xTipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "xNumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "xDatSit",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetCodUsuPorColab",
    documentation: "Esta função retornará o código do usuário associadr. Caso não houver retornará zero.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      }
    ]
  },
  {
    label: "MontarSQLHistoricoSeq",
    documentation: "Esta função retorna um SQL com base em uma data e seqüência para uso com os históricos do sistema",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Tabela",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "DataReferencia",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "SQL",
        isReturnValue: true
      }
    ]
  },
  {
    label: "MontarSQLHistorico",
    documentation: "Retorna um SQL com base em uma data para uso com os históricos do sistema",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Tabela",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "DataReferencia",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "SQL",
        isReturnValue: true
      }
    ]
  },
  {
    label: "RetSalEmp",
    documentation: "Esta função retorna o salário do funcionário em uma determinada data.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "DatSal",
        isReturnValue: false
      }
    ]
  },
  {
    label: "WTextoParaFormatoHTML",
    documentation: "Retorna a expressão alfanumérica passada como parâmetro convertida para HTML",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "TextoInicial",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "TextoFinal",
        isReturnValue: true
      }
    ]
  },
  {
    label: "RetEstCarEmp",
    documentation: "Função que retorna a estrutura de cargos utilizada pela empresa na data informada.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatRef",
        isReturnValue: false
      }
    ]
  },
  {
    label: "CalTotFolha",
    documentation: "Utilizada para carregar as variáveis de sistema",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "CodRat",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetCarEmp",
    documentation: "Retorna o Cargo do funcionário em uma determinada data.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatCar",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetNomCodNiv",
    documentation: "Retorna o Nome e o código do Local do Empregado em um determinado nível.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatRef",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NivIni",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NivFim",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "NomeLoc",
        isReturnValue: true
      },
      {
        type: EParameterType.Alfa,
        name: "CodNivLoc",
        isReturnValue: true
      }
    ]
  },
  {
    label: "TiraAcentos",
    documentation: "Retira os caracteres especiais, retornando o texto em maíusculo.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Texto",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Retorno",
        isReturnValue: true
      }
    ]
  },
  {
    label: "CalSalEmpCS",
    documentation: "Esta função retorna o salário do funcionário em relação ao tipo",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "TipSal",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "DataBase",
        isReturnValue: false
      }
    ]
  },
  {
    label: "ExtensoMes",
    documentation: "Esta função retorna o nome por extenso do mês passado como parâmetro",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "DataBase",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Extenso",
        isReturnValue: true
      }
    ]
  },
  {
    label: "BusSalClaNiv",
    documentation: "Esta função retorna o valor do salário da estrutura/classe/nível passados como parâmetro, e se desejar (informando tipo 2), o número de meses de complemento do nível salarial.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "EstruturaSalario",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Classe",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Nivel",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Tipo",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatSal",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NivelMercado",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "ValorSalario",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "NroMeses",
        isReturnValue: true
      }
    ]
  },
  {
    label: "RetExtMoeda",
    documentation: "Gera o extenso de um valor (moeda). Obs: não completa o espaço restante com o caracter “*”.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "Valor",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "ExtensoDoValor",
        isReturnValue: true
      }
    ]
  },
  {
    label: "ExtensoNumero",
    documentation: "Retorna o valor por extenso do número passado como parâmetro.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "Valor",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "ExtensoDoValor",
        isReturnValue: true
      }
    ]
  },
  {
    label: "ProximaPagina",
    documentation: "Permite verificar se uma determinada seção será impressa na próxima página.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Secao",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Retorno",
        isReturnValue: true
      }
    ]
  },
  {
    label: "BusHorBase",
    documentation: "Retorna o horário base do colaborador em uma determinada data.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatHor",
        isReturnValue: false
      }
    ]
  },
  {
    label: "Minusculo",
    documentation: "Converte um valor alfanumérico de maiúsculo para minúsculo (SOMENTE NO RUBI)",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Texto",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Retorno",
        isReturnValue: true
      },
      {
        type: EParameterType.Alfa,
        name: "PrimeiraLetraMiuscula(S/N)",
        isReturnValue: false
      }
    ]
  },
  {
    label: "ExecutaRelatorio",
    documentation: "Permite que sejam executados relatórios através das regras.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "NomeModelo",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "ExibirTelaEntrada",
        isReturnValue: false
      }
    ]
  },
  {
    label: "SetaNumeroTelaEntrada",
    documentation: "Permite ao usuário alterar os valores numéricos da tela de entrada do modelo.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "NomeCampo",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Valor",
        isReturnValue: false
      }
    ]
  },
  {
    label: "SetaDataTelaEntrada",
    documentation: "Permite ao usuário alterar os valores do tipo data da tela de entrada do modelo.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "NomeCampo",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Valor",
        isReturnValue: false
      }
    ]
  },
  {
    label: "SetaAlfaTelaEntrada",
    documentation: "Permite ao usuário alterar os valores alfanuméricos da tela de entrada do modelo.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "NomeCampo",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Valor",
        isReturnValue: false
      }
    ]
  },
  {
    label: "EscondeCampoTelaEntrada",
    documentation: "Permite ao usuário esconder determinados campos da tela de entrada do modelo",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "NomeCampo",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetCodNomLocNiv",
    documentation: "Retorna o nome e o código do local, no nível informado",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumLoc",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NroNiv",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "DatLoc",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "NomLoc",
        isReturnValue: true
      },
      {
        type: EParameterType.Alfa,
        name: "CodNivLoc",
        isReturnValue: true
      }
    ]
  },
  {
    label: "RetNumLocNiv",
    documentation: "Retorna o código do local no nível passado como parâmetro.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "TabOrg",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumLoc",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DataRef",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Nivel",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumLocNiv",
        isReturnValue: true
      }
    ]
  },
  {
    label: "ConvStrPNum",
    documentation: "Converte um valor tipo string para numérico.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "ValorEntrada",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "ValorRetorno",
        isReturnValue: true
      }
    ]
  },
  {
    label: "BuscaDiaSit",
    documentation: "Esta função retorna a quantidade de dias de uma situação em um período informado. Esta função não apresenta as seguintes situações: 15 (ronda) e 16 (todos os módulos)",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "nNumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nTipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nNumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "dDatIni",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "dDatFim",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nCodSit",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nQtdDia",
        isReturnValue: true
      }
    ]
  },
  {
    label: "RetSalEst",
    documentation: "Retorna o salário (sem nenhuma conversão) de uma Estrutura/Classe/Nível específica em uma determinada data.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "nEstSal",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aClaSal",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aNivSal",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "dDatRef",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetBHRDat",
    documentation: "Esta função retorna o saldo do banco de horas conforme a data especificada para verificação. O valor que será retornado corresponderá ao saldo inicial da data. Não são considerados os lançamentos efetuados no dia.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "CodBhr",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatBas",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "BhrDat",
        isReturnValue: true
      }
    ]
  },
  {
    label: "ExcLanBhr",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "CodBhr",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatLan",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "CodSit",
        isReturnValue: false
      }
    ]
  },
  {
    label: "IncLanBhr",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "CodBhr",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatLan",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "CodSit",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "QtdHor",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatCmp",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetDatCmp",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatLan",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "CodBhr",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "CodSit",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatCmp",
        isReturnValue: true
      }
    ]
  },
  {
    label: "RetTabOrgEmp",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "DataRef",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TabOrg",
        isReturnValue: true
      }
    ]
  },
  {
    label: "GravaFotoColaboradorEmDisco",
    documentation: "Grava a foto do colaborador em disco. Esta foto será salva no mesmo tamanho em que foi gravada no Banco de Dados, sempre no formato JPEG (*.JPG).",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "DirArq",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "NomArq",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Retorno[0=Sucesso | 1=Erro]",
        isReturnValue: true
      },
      {
        type: EParameterType.Alfa,
        name: "MsgErro",
        isReturnValue: true
      }
    ]
  },
  {
    label: "BusCadChefeLocal",
    documentation: "Busca o chefe de um local especificado.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TabOrg",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "CodLoc",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Turno",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Nivel",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatBas",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "EmpChe",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "TipChe",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "CadChe",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "LocChe",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "LocCol",
        isReturnValue: false
      }
    ]
  },
  {
    label: "ExecSQLEx",
    documentation: {
      kind: 'markdown',
      value: "Executa um comando SQL no banco. Nessa função podem ser usadas para as operações Insert, Update, Delete.\n\n**Observação**: Poderão ser utilizados comandos nativos do Banco de Dados e é permitido acessar objetos que não constam no TBS. **Para isso é necessário desativar a opção *Usar SQL Senior 2* da regra. **"
    },
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "ComandoSQL",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Sucesso",
        documentation: 'Os valores possíveis são: 0: Sucesso | 1: Erro.',
        isReturnValue: true
      },
      {
        type: EParameterType.Alfa,
        name: "MensagemErro",
        documentation: 'Texto com a Mensagem de erro gerado pela execução do Comando SQL.',
        isReturnValue: true
      }
    ]
  },
  {
    label: "InserirAlfa",
    documentation: "Insere um ou mais caracteres em uma Variável/Campo, a partir da posição indicada. Havendo informação no campo alfa, no qual deseja-se inserir o texto, as que estiverem a partir da posicão indicada serão deslocadas para a direita e o que passar do tamanho definido do campo/variável será truncado.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Texto_Origem",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Variável_Destino",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "Posicao_Inicial",
        isReturnValue: false
      }
    ]
  },
  {
    label: "TempoTrabFun",
    documentation: "Esta função retorna o tempo de trabalho em meses, de um funcionário em um determinado período",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "DataIni",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "DataFim",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "ConAfa",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NrMeses",
        isReturnValue: true
      }
    ]
  },
  {
    label: "MensagemLog",
    documentation: "Esta função cancela o processamento em execução e mostra a mensagem de erro passada como parâmetro",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Mensagem",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetPrxClaNiv",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "Opcao(1-Classe | 2-Nível)",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Estrutura",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "DatBas",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Classe",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Nivel",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "ProximaClasse",
        isReturnValue: true
      },
      {
        type: EParameterType.Alfa,
        name: "ProximoNivel",
        isReturnValue: true
      }
    ]
  },
  {
    label: "InsSQLWhereSimples",
    documentation: "Permite Inserir uma cláusula WHERE dentro de um SQL durante a execução da regra de pré-seleção. As tabelas referenciadas no SQL não são incluídas na cláusula FROM do comando SQL.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "NomeSecao",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "ClausulaWhere",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetAdiEmp",
    documentation: "Esta função retorna o Adicional do funcionário em uma determinada data",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "nNumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nTipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nNumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "dDatAdi",
        isReturnValue: false
      }
    ]
  },
  {
    label: "CalculaQtdDep",
    documentation: "Calcula a quantidade de dependentes.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "nNumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nTipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nNumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "dDatPag",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetEtbEmp",
    documentation: "Retorna a estabilidade do funcionário em uma determinada data.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "nNumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nTipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nNumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "dDatEtb",
        isReturnValue: false
      }
    ]
  },
  {
    label: "SQL_Criar",
    documentation: "Função que cria um cursor, ou um objeto para execução de SQL, e retorna no parâmetro \"Objeto\".",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        documentation: 'Informe o cursor.',
        isReturnValue: true
      }
    ]
  },
  {
    label: "SQL_Destruir",
    documentation: "Função que destrói um cursor depois de sua utilização, o mesmo deve ser chamado quando o cursor não for mais utilizado.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        documentation: 'Informe o cursor.',
        isReturnValue: true
      }
    ]
  },
  {
    label: "SQL_DefinirComando",
    documentation: "Função que aplica o comando SQL para o cursor passado como parâmetro.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        documentation: 'Informe o cursor.',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aSQL",
        isReturnValue: false
      }
    ]
  },
  {
    label: "SQL_BOF",
    documentation: "Função que retorna se o cursor está na posição inicial (antes do primeiro registro). Se o cursor está na posição BOF, o valor retornado é 1 (um), caso contrário é 0 (zero).",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        documentation: 'Informe o cursor.',
        isReturnValue: false
      }
    ]
  },
  {
    label: "SQL_EOF",
    documentation: "Função que retorna se o cursor está na posição final (depois do último registro). Se o cursor está na posição EOF, o valor retornado é 1 (um), caso contrário é 0 (zero)",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        documentation: 'Informe o cursor.',
        isReturnValue: false
      }
    ]
  },
  {
    label: "SQL_AbrirCursor",
    documentation: "Função que abre o cursor depois de informado o SQL a ser utilizado.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        documentation: 'Informe o cursor.',
        isReturnValue: false
      }
    ]
  },
  {
    label: "SQL_Proximo",
    documentation: "Função que posiciona o cursor no próximo registro.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        documentation: 'Informe o cursor.',
        isReturnValue: false
      }
    ]
  },
  {
    label: "SQL_FecharCursor",
    documentation: "Função que fecha a pesquisa sendo feita pelo cursor.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        documentation: 'Informe o cursor.',
        isReturnValue: false
      }
    ]
  },
  {
    label: "SQL_RetornarBoleano",
    documentation: "Função que retorna um valor boleano de um campo do registro do cursor.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        documentation: 'Informe o cursor.',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aCampo",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nValor",
        isReturnValue: true
      }
    ]
  },
  {
    label: "SQL_RetornarInteiro",
    documentation: "Função que retorna um valor inteiro de um campo do registro do cursor.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        documentation: 'Informe o cursor.',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aCampo",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nValor",
        isReturnValue: true
      }
    ]
  },
  {
    label: "SQL_RetornarFlutuante",
    documentation: "Função que retorna um valor flutuante de um campo do registro do cursor.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        documentation: 'Informe o cursor.',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aCampo",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nValor",
        isReturnValue: true
      }
    ]
  },
  {
    label: "SQL_RetornarData",
    documentation: "Função que retorna uma data de um campo do registro do cursor.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        documentation: 'Informe o cursor.',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aCampo",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "dValor",
        isReturnValue: true
      }
    ]
  },
  {
    label: "SQL_RetornarAlfa",
    documentation: "Função que retorna um valor do tipo alfa (string) de um campo do registro do cursor.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        documentation: 'Informe o cursor.',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aCampo",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aValor",
        isReturnValue: true
      }
    ]
  },
  {
    label: "SQL_RetornarBlob",
    documentation: "Função que retorna um Blob de um campo do registro do cursor.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        documentation: 'Informe o cursor.',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aCampo",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aValor",
        isReturnValue: true
      }
    ]
  },
  {
    label: "SQL_RetornarSeNulo",
    documentation: "Função que retorna um valor booleano, que significa se o campo é nulo ou não.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        documentation: 'Informe o cursor.',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aCampo",
        isReturnValue: false
      }
    ]
  },
  {
    label: "SQL_DefinirBoleano",
    documentation: "Função que define o valor de um parâmetro (seguindo as regras do SQL Senior 2) do tipo boleano.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        documentation: 'Informe o cursor.',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aCampo",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nValor",
        isReturnValue: false
      }
    ]
  },
  {
    label: "SQL_DefinirInteiro",
    documentation: "Função que define o valor de um parâmetro (seguindo as regras do SQL Senior 2) do tipo inteiro.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        documentation: 'Informe o cursor.',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aCampo",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nValor",
        isReturnValue: false
      }
    ]
  },
  {
    label: "SQL_DefinirFlutuante",
    documentation: "Função que define o valor de um parâmetro (seguindo as regras do SQL Senior 2) do tipo numérico com ponto flutuante.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        documentation: 'Informe o cursor.',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aCampo",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nValor",
        isReturnValue: false
      }
    ]
  },
  {
    label: "SQL_DefinirData",
    documentation: "Função que define o valor de um parâmetro (seguindo as regras do SQL Senior 2) do tipo data.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        documentation: 'Informe o cursor.',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aCampo",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "dValor",
        isReturnValue: false
      }
    ]
  },
  {
    label: "SQL_DefinirAlfa",
    documentation: "Função que define o valor de um parâmetro (seguindo as regras do SQL Senior 2) do tipo alfanumérico.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        documentation: 'Informe o cursor.',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aCampo",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aValor",
        isReturnValue: false
      }
    ]
  },
  {
    label: "SQL_DefinirBlob",
    documentation: "Função que seta define o valor de um parâmetro (seguindo as regras do SQL Senior 2) do tipo blob.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        documentation: 'Informe o cursor.',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aCampo",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aValor",
        isReturnValue: false
      }
    ]
  },
  {
    label: "SQL_UsarAbrangencia",
    documentation: "Função que informa ao cursor se é para utilizar abrangência de usuários.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        documentation: 'Informe o cursor.',
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nUsar",
        isReturnValue: false
      }
    ]
  },
  {
    label: "SQL_UsarSQLSenior2",
    documentation: {
      kind: 'markdown',
      value: 'Informa se o comando a ser definido para o cursor utiliza a sintaxe de linguagem Senior ou a sintaxe nativa (linguagem originada da base de dados utilizada, por exemplo Oracle e SQL Server).\n\nPara utilização de comandos nativos é **necessário desabilitar** as rotina de abrangência através da função **SQL_UsarAbrangencia** e, em seguida, informar que não será utilizado a linguagem Senior.'
    },
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        documentation: 'Informe o cursor.',
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nUsar",
        documentation: '0 para definir que não será utilizada sintaxe SQL Senior 2 ou um valor diferente de zero para definir que será utilizada a sintaxe SQL Senior 2.',
        isReturnValue: false
      }
    ]
  },
  {
    label: "CalSalEmp",
    documentation: "Retorna o salário do funcionário em relação ao tipo.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "nTipCal",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nNumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nTipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nNumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "dDatSal",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetQtdDiasUtil",
    documentation: "Retorna a quantidade de dias úteis dentro de um determinado período, levando-se em consideração os dias de segunda a sexta-feira, desde que não estejam cadastrados como feriado na Tabela de Feriados passada como parâmetro na função.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Data,
        name: "dDatIni",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "dDatFim",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nTabFer",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nQtdDiasUtil",
        isReturnValue: true
      }
    ]
  },
  {
    label: "RetApuPon",
    documentation: "Esta função retorna o tipo de apuração do colaborador, conforme o histórico de apuração.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "nNumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nTipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nNumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "dDatApu",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nApuPon",
        isReturnValue: true
      }
    ]
  },
  {
    label: "RetFilEmp",
    documentation: "Retorna a filial do funcionário em uma determinada data.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "nNumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nTipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nNumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "dDatRef",
        isReturnValue: false
      }
    ]
  },
  {
    label: "CarregaImgControle",
    documentation: "Carregar uma imagem do banco ou arquivo para um controle imagem do modelo",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "NomeDoControleImagem",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Opcao[0-Arquivo;1-Banco;2-Variavel]",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "CaminhoCampoNome",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "ClausulaWhereSQL",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "SqlSenior2",
        isReturnValue: false
      }
    ]
  },
  {
    label: "Abrir",
    type: LSPTypeObject.Function,
    documentation: 'Abre arquivos no disco local ou na rede. Se a função for bem sucedida, o valor de retorno será o manipulador de arquivo. Este valor não poderá ser alterado, caso contrário a regra não terá condições de operar com o arquivo. Se a função falhar, um erro acontece e a regra é cancelada.',
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "NomeArquivo",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "ModoAbertura [Ler|Gravar|LerNL|GravarNL]",
        documentation:
        {
          kind: 'markdown',
          value:
            'Determina o modo de abertura do arquivo:\n'
            + '  - **Ler**: Leitura binária\n'
            + '  - **Gravar**: Escrita binária\n'
            + '  - **LerNL**: Leitura em modo texto\n'
            + '  - **GravarNL**: Escrita em modo texto\n'
        },
        isReturnValue: false
      }
    ]
  },
  {
    label: "Fechar",
    type: LSPTypeObject.Method,
    documentation: 'Fecha um arquivo previamente aberto.',
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "NomeArquivo",
        isReturnValue: false
      }
    ]
  },
  {
    label: "Gravar",
    type: LSPTypeObject.Function,
    documentation: 'Escreve determinado número de bytes para um arquivo binário e retorna o número de bytes gravados no arquivo.',
    parameters: [
      {
        type: EParameterType.Numero,
        name: "ManipuladorArquivo",
        documentation: 'Determina o manipulador de arquivo para onde os dados serão gravados.',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Dados",
        documentation: 'Indica a variável de onde os dados serão obtidos para a gravação no arquivo.',
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumeroDeBytes",
        documentation: 'Indica o número de bytes que devem ser lidos do arquivo.',
        isReturnValue: false
      }
    ]
  },
  {
    label: "AbrirArquivo",
    type: LSPTypeObject.Function,
    documentation: "Esta função abre o arquivo passado como parâmetro. Pode ser utilizada para testar se um arquivo existe em um determinado local. Se o arquivo for aberto corretamente, a função retornará 1. Se ocorrer algum problema e o arquivo não puder ser aberto, ela retornará 0.",
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Arquivo",
        documentation: "Nome do arquivo a ser aberto.",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Retorno",
        documentation: "Variável que receberá o resultado da função. Se o arquivo for aberto corretamente, ela receberá 1. Caso contrário, ela receberá 0.",
        isReturnValue: true
      }
    ]
  },
  {
    label: "LerNovaLinha",
    type: LSPTypeObject.Method,
    documentation: "Esta função funciona em conjunto com a função 'AbrirArquivo'. Após abrir o arquivo é possível ler linha a linha do arquivo.",
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Linha",
        documentation: "Variável que receberá o conteúdo de cada linha do arquivo.",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "Retorno",
        documentation: "Se conseguiu ler a linha normalmente vai retornar 1. Caso contrário se chegou no final do arquivo o retorno será 0(zero).",
        isReturnValue: true
      }
    ]
  },
  {
    label: "GravarNL",
    type: LSPTypeObject.Method,
    documentation: 'Grava uma linha no arquivo indicado pelo <manipulador de arquivo> com o valor da <variável> passada como parâmetro.',
    parameters: [
      {
        type: EParameterType.Numero,
        name: "ManipuladorArquivo",
        documentation: 'Determina o manipulador de arquivo para onde os dados serão gravados.',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "ValorLinha",
        documentation: 'Indica a variável de onde os dados serão obtidos para a gravação no arquivo texto.',
        isReturnValue: false
      }
    ]
  },
  {
    label: "GravarNLEOL",
    type: LSPTypeObject.Method,
    documentation: 'Grava uma linha em um arquivo texto com a opção de incluir a quebra de linha ao final.',
    parameters: [
      {
        type: EParameterType.Numero,
        name: "ManipuladorArquivo",
        documentation: 'Determina o manipulador de arquivo para onde os dados serão gravados.',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "ValorLinha",
        documentation: 'Indica a variável de onde os dados serão obtidos para a gravação no arquivo texto.',
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "UseEOL [0:Não | 1:Sim]",
        documentation: 'Determina se deve ou não ser adicionada a quebra de linha ao final.',
        isReturnValue: false
      }
    ]
  },
  {
    label: "Ler",
    type: LSPTypeObject.Function,
    documentation: {
      kind: 'markdown',
      value: 'Lê determinado números de bytes do arquivo binário indicado. Esta função retorna o **número de bytes** que foram **lidos** do arquivo. Se a leitura atingiu o final do arquivo, o retorno será o **número de bytes lidos** até o final do arquivo.'
    },
    parameters: [
      {
        type: EParameterType.Numero,
        name: "ManipuladorArquivo",
        documentation: 'Determina o manipulador de arquivo para onde os dados serão gravados.',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Retorno",
        documentation: 'Indica a variável de onde os dados serão obtidos para leitura.',
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "NumeroDeBytes",
        documentation: 'Indica o número de bytes que devem ser lidos do arquivo.',
        isReturnValue: false
      }
    ]
  },
  {
    label: "LerNL",
    type: LSPTypeObject.Function,
    documentation: {
      kind: 'markdown',
      value: 'Lê uma linha de um arquivo texto. Se a função conseguiu ler uma ou mais linhas, o retorno será **1**. Se o final do arquivo for atingido ou se o arquivo não contiver nenhum texto, o retorno será **0 (zero)**.\n\n'
        + '**Observação:** A função LerNL considera apenas como quebra de linha *“CRLF”* ou *“#13#10”*, padrão do sistema operacional Windows.'
    },
    parameters: [
      {
        type: EParameterType.Numero,
        name: "ManipuladorArquivo",
        documentation: 'Determina o manipulador de arquivo para onde os dados serão gravados.',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Retorno",
        documentation: 'Indica a variável de onde os dados serão obtidos para leitura.',
        isReturnValue: true
      }
    ]
  },
  {
    label: "ExecutaTelaSGI",
    documentation: "Esta função executa a tela do SGI passada como parâmetro. Se a tela for executada com sucesso, a função retornará 1. Caso contrário, retornará 0.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "xNomeTela",
        isReturnValue: false
      }
    ]
  },
  {
    label: "GlbRetVarStr",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aVarNome",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aVarValor",
        isReturnValue: true
      }
    ]
  },
  {
    label: "GlbAdiVarStr",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aVarNome",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aVarValor",
        isReturnValue: true
      }
    ]
  },
  {
    label: "CarregaAbrUsu",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aNomCam",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "aCond",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aSobrepoeAbr",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aValorAbr",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetornaAbrUsu",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aCodMod",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "aTipoAbr",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "aCodUsu",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "aIDPerfil",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "aCond",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aCampo",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aValAbr",
        isReturnValue: true
      }
    ]
  },
  {
    label: "SetaValorFormula",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "aNomeControle",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nValorControle",
        isReturnValue: false
      }
    ]
  },
  {
    label: "BusCraTit",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "nNumEmpFun",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nTipColFun",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nNumCadFun",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "dDatAccFun",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nNumCraFun",
        isReturnValue: true
      }
    ]
  },
  {
    label: "VerNumAbr",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "nNumero",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aAbrangencia",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nRetorno (0-Não está|1-Está)",
        isReturnValue: true
      }
    ]
  },
  {
    label: "MontaCriteriosAperfeicoamento",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "xHisCua",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "xValCua",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "xRevCua",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "xCerApr",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "xCerPar",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "xSitAnd",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "xSitCom",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "xSitDes",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "xSitSus",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "xSitMed",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "xSitFre",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "xSitTrf",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "xAbrCua",
        isReturnValue: false
      }
    ]
  },
  {
    label: "WPersonalizaMenuWeb",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "nPosicao",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aMenuPai",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aTitulo",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aLink",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aNome",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aTipo",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nTarget",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetLocNiv",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "nNumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nTipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nNumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nNroNiv",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "CodLoc",
        isReturnValue: true
      }
    ]
  },
  {
    label: "CarregaDistribuicaoEPI",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TabOrg",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumLoc",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "EstCar",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "CodCar",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "DatIni",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "DatFim",
        isReturnValue: false
      },
      {
        type: EParameterType.Data,
        name: "DatRef",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "AbrEpi",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "ColBom",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "TipOpe",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "TipPes",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipOrd",
        isReturnValue: false
      }
    ]
  },
  {
    label: "GlbAdiVarNumDat",
    documentation: "Adiciona uma variável global numérica/data em memória",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aVarNome",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nValor",
        isReturnValue: false
      }
    ]
  },
  {
    label: "GlbAdiVarStr",
    documentation: "Adiciona uma variável global alfa numérica em memória",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "VarNome",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aValor",
        isReturnValue: false
      }
    ]
  },
  {
    label: "GlbRetVarNumDat",
    documentation: "Retorna o conteúdo de uma variável global numérica, armazenada pela função GlbAdiVarNumDat. Exemplo: x := GlbRetVarNumDat(vNomVar);",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "VarNome",
        isReturnValue: false
      }
    ]
  },
  {
    label: "GlbRetVarStr",
    documentation: "Retorna o conteúdo de uma variável global armazenada pela função GlbAdiVarStr.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "VarNome",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aVarValor",
        isReturnValue: true
      }
    ]
  },
  {
    label: "AlteraValorFormula",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aNomeFormula",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nValor",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetHorPrvTrb",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "NumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "TipCol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "NumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatIni",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "HorIni",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatFim",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "HorFim",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "DatVer",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "xhorprv",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "xdiaint",
        isReturnValue: true
      }
    ]
  },
  {
    label: "WCheckValImage",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aCampo",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aDescricao",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aRetorno",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "lfa aOpcional",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aExtensao",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "aTamMax",
        isReturnValue: false
      }
    ]
  },
  {
    label: "GravaImagemBanco",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aTabela",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aCamposChave",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aOutrosCampos",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aCampoImagem",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "aOrigem",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aArquivo",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aMensagem",
        isReturnValue: true
      }
    ]
  },
  {
    label: "Encriptar",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aValor",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "aChave",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aResultado",
        isReturnValue: true
      }
    ]
  },
  {
    label: "Desencriptar",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aValor",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "aChave",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aResultado",
        isReturnValue: true
      }
    ]
  },
  {
    label: "ArqExiste",
    type: LSPTypeObject.Function,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aNomeArq",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetHorTrab",
    documentation: "Retorna a quantidade de horas trabalhadas num determinado período.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "nNumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "dDatIni",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "dDatFim",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aAbrTip",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aAbrLoc",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aFilSit",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aAbrSit",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nQtdHor",
        isReturnValue: true
      }
    ]
  },
  {
    label: "ConverteDataHoraDateTime",
    documentation: "A função serve para montar uma data e uma hora passados como parâmetro em uma string no formato datetime do banco.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "dData",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nHora",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aDataHoraBanco",
        isReturnValue: true
      }
    ]
  },
  {
    label: "GeraHash",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Texto",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Algoritmo [MD5 | SHA1 | SHA256 | SHA512]",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Hash",
        isReturnValue: true
      }
    ]
  },
  {
    label: "WRemoteAddr",
    documentation: "Retorna o endereço IP da estação que está acessando o sistema. Utilizada apenas nos sistemas Web.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aIp",
        isReturnValue: true
      }
    ]
  },
  {
    label: "SegEntLe",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "nCodEnt",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        isReturnValue: true
      }
    ]
  },
  {
    label: "SegEntEhUsuario",
    documentation: "Esta função indica se o Usuário/Grupo passado em aObjeto é um usuário. Se sim o resultado direto da função é 1 senão será 0.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        isReturnValue: false
      }
    ]
  },
  {
    label: "SegUsuAtivado",
    documentation: "Esta função indica se o acesso ao usuário passado em aObjeto está desativado. Se sim o resultado direto da função é 1 senão será 0.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        isReturnValue: false
      }
    ]
  },
  {
    label: "SegEntQtdGrp",
    documentation: "Esta função retorna diretamente a quantidade de grupos do Usuário/Grupo passado em aObjeto.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        isReturnValue: false
      }
    ]
  },
  {
    label: "SegEntNome",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aNome",
        isReturnValue: true
      }
    ]
  },
  {
    label: "SegUsuNomeComp",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aNome",
        isReturnValue: true
      }
    ]
  },
  {
    label: "SegUsuSetaSenha",
    documentation: "Esta função seta a senha do usuário passado em aObjeto através do parâmetro aNovaSenha retornando o aObjeto(Usuário) com a senha setada.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        isReturnValue: true
      },
      {
        type: EParameterType.Alfa,
        name: "aNovaSenha",
        isReturnValue: false
      }
    ]
  },
  {
    label: "SegUsuSetaAtivado",
    documentation: "Esta função seta a opção Conta Desabilitada do usuário passado em aObjeto através do parâmetro nOpcao: 1 = Conta Habilitada ou 0 = Conta Desabilitada retornando aObjeto(Usuário) com a opção setada.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "nOpcao [0:Desabilitar | 1: Habilitar]",
        isReturnValue: false
      }
    ]
  },
  {
    label: "SegUsuDatExp",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aObjeto",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetDiaHor",
    documentation: "Função que concatena os dias da semana que contenham o mesmo horário de curso.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "nCodHCu",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aNomDia1",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aNomDia2",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aNomDia3",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aNomDia4",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aNomDia5",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aNomDia6",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aNomDia7",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aStrHor1",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aStrHor2",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aStrHor3",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aStrHor4",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aStrHor5",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aStrHor6",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aStrHor7",
        isReturnValue: false
      }
    ]
  },
  {
    label: "RetornaDistribuicaoEPI",
    documentation: "Retorna item a item dos resultados encontrados em CarregaDistribuicaoEPI. Os itens podem ser navegados através dos parâmetro TipOpe, que retorna o item escolhido na lista, como, primeiro, ultimo, próximo e anterior. A função CarregaDistribuicaoEPI deve sempre ser chamada antes da RetornaDistribuicaoEPI para que os dados sejam carregados anteriormente.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "TipOpe",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "CodEpi",
        isReturnValue: true
      },
      {
        type: EParameterType.Alfa,
        name: "MedEpi",
        isReturnValue: true
      },
      {
        type: EParameterType.Alfa,
        name: "DesMot",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "DatEnt",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "DatRev",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "DatVal",
        isReturnValue: true
      },
      {
        type: EParameterType.Alfa,
        name: "RecIns",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "DatAju",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "CodMtv",
        isReturnValue: true
      },
      {
        type: EParameterType.Numero,
        name: "DatDev",
        isReturnValue: true
      }
    ]
  },
  {
    label: "ValidaPISCPF",
    documentation: "Função para Validar um número de CPF ou PIS.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "nTipo [1-PIS | 2-CPF]",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aPISCPF",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nValido [0-OK | 10-Inválido]",
        isReturnValue: true
      }
    ]
  },
  {
    label: "TrocaCadastro",
    documentation: "Esta função tem a funcionalidade de efetuar a troca de cadastro de colaboradores.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "nCadNov",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nCadAnt",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nTipCol",
        isReturnValue: false
      }
    ]
  },
  {
    label: "SegEntExistePorNome",
    documentation: "Essa função verifica pelo nome se o usuário/grupo existe.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "aNome",
        isReturnValue: false
      }
    ]
  },
  {
    label: "NumeroParaAlfa",
    documentation: "Converte um número para formato alfanumérico, mantendo as casas decimais e sem arredondar.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "nOrigem",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aDestino",
        isReturnValue: true
      }
    ]
  },
  {
    label: "GravaFotoColaboradorEmDisco",
    documentation: "Grava a foto do colaborador em disco. Esta foto será salva no mesmo tamanho em que foi gravada no Banco de Dados, sempre no formato JPEG (*.JPG).",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "nNumEmp",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nTipcol",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nNumCad",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aDirArq",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aNomArq",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nRetorno",
        isReturnValue: true
      },
      {
        type: EParameterType.Alfa,
        name: "aMsgErro",
        isReturnValue: false
      }
    ]
  },
  {
    label: "GravaFotoCandidatoEmDisco",
    documentation: "Grava a foto do candidato em disco. Esta foto será salva no mesmo tamanho em que foi gravada no Banco de Dados,  no formato JPEG (*.JPG).",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "nNumCan",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aDirArq",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aNomArq",
        isReturnValue: false
      },
      {
        type: EParameterType.Numero,
        name: "nRetorno",
        isReturnValue: true
      },
      {
        type: EParameterType.Alfa,
        name: "aMsgErro);",
        isReturnValue: true
      }
    ]
  },
  {
    label: "RetornaNomeUsuario",
    documentation: "É uma função que permite utilizar os nomes disponíveis no cadastro de propriedades do usuário no SGU - Senior Gerenciador de usuários.",
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Numero,
        name: "aCodUsu",
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "aNomUsu",
        isReturnValue: true
      }
    ]
  },
  {
    label: "ConverteCodificacaoString",
    documentation: 'Esta função altera a codificação de um texto contido em uma variável, onde este texto com a codificação alterada pode ser utilizado para comunicação com web services. Se o sistema não suportar a codificação informada, será emitida a seguinte mensagem: "A codificação X não é suportada. Verifique a documentação".',
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Texto",
        documentation: 'Contém o texto original que necessita ter sua codificação alterada',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Codificacao",
        documentation: 'Nome da codificação que ser utilizada, suporta as codificações: "UTF-8" ou "WINDOWS-1252"',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Retorno",
        documentation: 'Contém o texto com a codificação alterada',
        isReturnValue: true
      }
    ]
  },
  {
    label: "Base64Decode",
    documentation: 'Decodifica um valor base64 passado.',
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Texto",
        documentation: 'Contém o texto original que necessita ser decodificado',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Retorno",
        documentation: 'Contém o texto decodificado',
        isReturnValue: true
      }
    ]
  },
  {
    label: "Base64Encode",
    documentation: 'Codifica para base64 o conteúdo passado.',
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Texto",
        documentation: 'Contém o texto original que necessita ser codificado',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Retorno",
        documentation: 'Contém o texto codificado',
        isReturnValue: true
      }
    ]
  },
  {
    label: "WebCodificaUrl",
    documentation: 'Esta função faz a codificação dos caracteres de forma a concatenar em URLs de forma segura.',
    type: LSPTypeObject.Method,
    parameters: [
      {
        type: EParameterType.Alfa,
        name: "Texto",
        documentation: 'Contém o texto original que necessita ser codificado',
        isReturnValue: false
      },
      {
        type: EParameterType.Alfa,
        name: "Retorno",
        documentation: 'Contém o texto codificado',
        isReturnValue: true
      }
    ]
  }
];
