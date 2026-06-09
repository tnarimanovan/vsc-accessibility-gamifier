import * as vscode from 'vscode';
import * as fs from 'fs';

export class MoleWebviewPanel {
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  public static create(
    extensionUri: vscode.Uri,
    onDispose: () => void,
  ): MoleWebviewPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    const panel = vscode.window.createWebviewPanel(
      'moleHome',
      "Mole's Burrow",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
        retainContextWhenHidden: true,
      },
    );

    return new MoleWebviewPanel(panel, extensionUri, onDispose);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly _extensionUri: vscode.Uri,
    onDispose: () => void,
  ) {
    this._panel = panel;
    this._update();

    this._panel.onDidDispose(
      () => {
        onDispose();
        this.dispose();
      },
      null,
      this._disposables,
    );
  }

  public reveal() {
    this._panel.reveal();
  }

  public updateGameState(state: any) {
    this._panel.webview.postMessage({ type: 'updateState', data: state });
  }

  private _update() {
    this._panel.webview.html = this._getHtmlForWebview();
  }

  private _getHtmlForWebview(): string {
    const htmlUri = vscode.Uri.joinPath(
      this._extensionUri,
      'media',
      'MoleBurrow.html',
    );
    const mediaUri = (fileName: string) => {
      const fileUri = vscode.Uri.joinPath(
        this._extensionUri,
        'media',
        fileName,
      );
      return this._panel.webview.asWebviewUri(fileUri).toString();
    };

    try {
      let htmlContent = fs.readFileSync(htmlUri.fsPath, 'utf8');

      const imagesSript = `
        <script>
          window.MOLE_IMAGES = {
            bored: "${mediaUri('mole-bored.png')}",
            thinking: "${mediaUri('mole-thinking.png')}",
            handsUp: "${mediaUri('mole-hands-up.png')}",
            digging: "${mediaUri('mole-digging.png')}",
            outsideHelmet: "${mediaUri('mole-outside-helmet.png')}",
            outsideHappy: "${mediaUri('mole-outside-happy.png')}"
          };
        </script>
      `;

      htmlContent = htmlContent.replace('</head>', `${imagesSript}</head>`);
      return htmlContent;
    } catch (error) {
      return `
        <!DOCTYPE html>
        <html>
        <body>
          <h2>Error loading interface template!</h2>
          <p>${error}</p>
        </body>
        </html>
      `;
    }
  }

  public dispose() {
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
