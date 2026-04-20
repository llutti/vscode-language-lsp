import * as vscode from 'vscode';

type OnboardingWebviewInput = {
  context: vscode.ExtensionContext;
  onOpenSettings: () => Promise<void>;
};

let onboardingPanel: vscode.WebviewPanel | null = null;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function detectLocale(language: string): 'pt-br' | 'es' | 'en' {
  const normalized = language.toLowerCase();
  if (normalized.startsWith('pt')) return 'pt-br';
  if (normalized.startsWith('es')) return 'es';
  return 'en';
}

function localizedStrings(language: string): {
  title: string;
  subtitle: string;
  steps: Array<{ title: string; description: string; image: string }>;
  openSettings: string;
} {
  const locale = detectLocale(language);
  if (locale === 'pt-br') {
    return {
      title: 'LSP - Primeiros passos',
      subtitle: 'Configuração de contextos, modo SingleFile, diagnósticos por ID, quick fixes e formatter.',
      steps: [
        {
          title: '1. Configurar contextos',
          description: 'Ajuste lsp.contexts com rootDir, filePattern e includeSubdirectories para mapear corretamente os arquivos do projeto.',
          image: 'contexts.svg'
        },
        {
          title: '2. SingleFile fallback',
          description: 'Arquivos fora de contexto usam modo SingleFile; selecione o system fallback na barra de status.',
          image: 'singlefile.svg'
        },
        {
          title: '3. Diagnósticos por ID',
          description: 'Ignore IDs por escopo (workspace/usuário) apenas quando necessário e revise periodicamente.',
          image: 'diagnostics.svg'
        },
        {
          title: '4. Quick fixes',
          description: 'Aplique quick fixes com confirmação de identificador quando houver rename.',
          image: 'quickfix.svg'
        },
        {
          title: '5. Formatter',
          description: 'Use Format Document para normalizar whitespace preservando strings, comentários e EOL.',
          image: 'formatter.svg'
        }
      ],
      openSettings: 'Abrir configurações da extensão'
    };
  }

  if (locale === 'es') {
    return {
      title: 'LSP - Primeros pasos',
      subtitle: 'Configuración de contextos, modo SingleFile, diagnósticos por ID, quick fixes y formatter.',
      steps: [
        {
          title: '1. Configurar contextos',
          description: 'Ajusta lsp.contexts con rootDir, filePattern e includeSubdirectories para mapear correctamente los archivos del proyecto.',
          image: 'contexts.svg'
        },
        {
          title: '2. SingleFile fallback',
          description: 'Archivos fuera de contexto usan modo SingleFile; selecciona el sistema fallback en la barra de estado.',
          image: 'singlefile.svg'
        },
        {
          title: '3. Diagnósticos por ID',
          description: 'Ignora IDs por alcance (workspace/usuario) solo cuando sea necesario y revísalos periódicamente.',
          image: 'diagnostics.svg'
        },
        {
          title: '4. Quick fixes',
          description: 'Aplica quick fixes con confirmación de identificador cuando haya rename.',
          image: 'quickfix.svg'
        },
        {
          title: '5. Formatter',
          description: 'Usa Format Document para normalizar whitespace preservando strings, comentarios y EOL.',
          image: 'formatter.svg'
        }
      ],
      openSettings: 'Abrir configuración de la extensión'
    };
  }

  return {
    title: 'LSP - Getting Started',
    subtitle: 'Context setup, SingleFile mode, diagnostics by ID, quick fixes and formatter.',
    steps: [
      {
        title: '1. Configure contexts',
        description: 'Set lsp.contexts with rootDir, filePattern and includeSubdirectories to map project files correctly.',
        image: 'contexts.svg'
      },
      {
        title: '2. SingleFile fallback',
        description: 'Files outside contexts use SingleFile mode; pick the fallback system in the status bar.',
        image: 'singlefile.svg'
      },
      {
        title: '3. Diagnostics by ID',
        description: 'Ignore IDs by scope (workspace/user) only when needed and review those choices regularly.',
        image: 'diagnostics.svg'
      },
      {
        title: '4. Quick fixes',
        description: 'Apply quick fixes with identifier confirmation when rename is required.',
        image: 'quickfix.svg'
      },
      {
        title: '5. Formatter',
        description: 'Use Format Document to normalize whitespace while preserving strings, comments and EOL.',
        image: 'formatter.svg'
      }
    ],
    openSettings: 'Open extension settings'
  };
}

function renderHtml(input: OnboardingWebviewInput): string {
  const webview = onboardingPanel!.webview;
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const strings = localizedStrings(vscode.env.language);
  const imageUri = (name: string) =>
    webview.asWebviewUri(vscode.Uri.joinPath(input.context.extensionUri, 'images', 'walkthrough', name)).toString();
  const rows = strings.steps
    .map((step) => `
      <article class="card">
        <img src="${imageUri(step.image)}" alt="${escapeHtml(step.title)}" />
        <h3>${escapeHtml(step.title)}</h3>
        <p>${escapeHtml(step.description)}</p>
      </article>
    `)
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <title>${escapeHtml(strings.title)}</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --muted: var(--vscode-descriptionForeground);
      --border: var(--vscode-panel-border);
      --chip: var(--vscode-button-secondaryBackground);
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--fg); font: 14px/1.5 var(--vscode-font-family); }
    .page { max-width: 1100px; margin: 0 auto; padding: 28px 20px 86px; }
    h1 { margin: 0; font-size: 28px; }
    .subtitle { margin: 8px 0 20px; color: var(--muted); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
    .card { border: 1px solid var(--border); border-radius: 10px; background: color-mix(in oklab, var(--bg), #000 3%); padding: 14px; }
    .card img { width: 100%; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 10px; }
    .card h3 { margin: 0 0 8px; font-size: 16px; }
    .card p { margin: 0; color: var(--muted); }
    .footer {
      position: fixed; left: 0; right: 0; bottom: 0; border-top: 1px solid var(--border);
      background: color-mix(in oklab, var(--bg), #000 5%);
      padding: 10px 16px; display: flex; align-items: center; justify-content: flex-end;
    }
    .settings {
      border: 1px solid var(--border); background: var(--chip); color: var(--fg);
      padding: 6px 10px; border-radius: 8px; cursor: pointer;
    }
  </style>
</head>
<body>
  <main class="page">
    <h1>${escapeHtml(strings.title)}</h1>
    <p class="subtitle">${escapeHtml(strings.subtitle)}</p>
    <section class="grid">${rows}</section>
  </main>
  <footer class="footer">
    <button id="openSettings" class="settings" type="button">${escapeHtml(strings.openSettings)}</button>
  </footer>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('openSettings')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'openSettings' });
    });
  </script>
</body>
</html>`;
}

export function openOnboardingWebview(input: OnboardingWebviewInput): void {
  if (!onboardingPanel) {
    onboardingPanel = vscode.window.createWebviewPanel(
      'lspOnboardingV2',
      localizedStrings(vscode.env.language).title,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(input.context.extensionUri, 'images', 'walkthrough')],
        retainContextWhenHidden: true
      }
    );

    onboardingPanel.onDidDispose(() => {
      onboardingPanel = null;
    });

    onboardingPanel.webview.onDidReceiveMessage(async (message: { type?: string }) => {
      if (message?.type === 'openSettings') {
        await input.onOpenSettings();
      }
    });
  } else {
    onboardingPanel.reveal(vscode.ViewColumn.Active, false);
  }

  onboardingPanel.title = localizedStrings(vscode.env.language).title;
  onboardingPanel.webview.html = renderHtml(input);
}
