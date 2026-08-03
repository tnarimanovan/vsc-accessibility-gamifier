import * as vscode from 'vscode';
import * as fs from 'fs';
import { MOLE_ASSETS_MAP } from '../shared/moleAssets';
import { A11yErrorDetail } from '../shared/models';

export class MoleWebviewPanel {
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _isDisposed = false;
  private _onReadyCallback?: () => void;
  private _onMessageCallback?: (message: any) => void;

  public static create(
    extensionUri: vscode.Uri,
    onDispose: () => void,
    onReady?: () => void,
    onMessage?: (message: any) => void,
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

    const instance = new MoleWebviewPanel(panel, extensionUri, onDispose);
    instance._onReadyCallback = onReady;
    instance._onMessageCallback = onMessage;
    return instance;
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
      async (message: any) => {
        if (this._isDisposed) return;

        if (this._onMessageCallback) {
          this._onMessageCallback(message);
        }

        const messageType = message.type || message.command;

        switch (messageType) {
          case 'TOGGLE_HIGHLIGHTING': {
            const isEnabled = message.payload?.enabled;
            await vscode.workspace
              .getConfiguration('accessibilityMole')
              .update('enableCodeHighlighting', isEnabled, true);
            break;
          }
          case 'UI_READY': {
            if (this._onReadyCallback) {
              this._onReadyCallback();
            }
            break;
          }
        }
      },
      null,
      this._disposables,
    );
  }

  public reveal() {
    if (this._isDisposed) return;
    this._panel.reveal();
  }

  public updateGameState(state: any, eventType: string = 'STATE_UPDATE') {
    if (this._isDisposed) return;

    this._panel.webview.postMessage({
      type: 'STATE_UPDATE',
      payload: {
        state,
        eventType,
      },
    });
  }

  private _update() {
    if (this._isDisposed) return;
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
      return `<!DOCTYPE html><html><body><h2>Error loading interface template!</h2><p>${error}</p></body></html>`;
    }
  }

  public sendDocumentDiagnostics(
    fileName: string,
    errorLines: number[],
    errorDetails: A11yErrorDetail[] = [],
  ): void {
    if (this._isDisposed || !this._panel) return;
    this._panel.webview.postMessage({
      type: 'DIAGNOSTICS_UPDATE',
      payload: {
        fileName,
        errorLines,
        errorDetails,
      },
    });
  }

  public isVisible(): boolean {
    if (this._isDisposed) return false;
    return this._panel.visible;
  }

  public onDidChangeVisibility(callback: (visible: boolean) => void) {
    if (this._isDisposed) return;
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
    onReady?: () => void,
    onMessage?: (message: any) => void,
  ): MoleWebviewPanel {
    const instance = new MoleWebviewPanel(panel, extensionUri, onDispose);
    instance._onReadyCallback = onReady;
    instance._onMessageCallback = onMessage;
    return instance;
  }

  public dispose() {
    if (this._isDisposed) return;
    this._isDisposed = true;

    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
