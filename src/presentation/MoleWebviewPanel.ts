import * as vscode from 'vscode';
import * as fs from 'fs';
import { MOLE_ASSETS_MAP } from '../shared/moleAssets';

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

    // Listen to IPC message events coming up from the UI frontend layer
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'TOGGLE_HIGHLIGHTING': {
            const isEnabled = message.payload.enabled;

            // Programmatically update the user's workspace profile configuration settings
            await vscode.workspace
              .getConfiguration('accessibilityMole')
              .update('enableCodeHighlighting', isEnabled, true);
            break;
          }
        }
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

      const resolvedAssets: Record<number, Record<string, string>> = {};

      for (const [stage, moods] of Object.entries(MOLE_ASSETS_MAP)) {
        const stageNum = Number(stage);
        resolvedAssets[stageNum] = {};

        for (const [mood, fileName] of Object.entries(moods)) {
          resolvedAssets[stageNum][mood] = mediaUri(fileName);
        }
      }

      const imagesScript = `
        <script>
          window.MOLE_ASSETS = ${JSON.stringify(resolvedAssets)};
        </script>
      `;

      htmlContent = htmlContent.replace('</head>', `${imagesScript}</head>`);
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

  public sendDocumentDiagnostics(fileName: string, errorLines: number[]): void {
    if (this._panel) {
      this._panel.webview.postMessage({
        type: 'DIAGNOSTICS_UPDATE',
        payload: {
          fileName,
          errorLines,
        },
      });
    }
  }

  public isVisible(): boolean {
    return this._panel.visible;
  }

  public onDidChangeVisibility(callback: (visible: boolean) => void) {
    this._panel.onDidChangeViewState(
      (e) => callback(e.webviewPanel.visible),
      null,
      this._disposables,
    );
  }

  public static revive(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    onDispose: () => void,
  ): MoleWebviewPanel {
    return new MoleWebviewPanel(panel, extensionUri, onDispose);
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
