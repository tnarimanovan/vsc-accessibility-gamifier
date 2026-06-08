import * as vscode from 'vscode';
import { Worker } from 'worker_threads';
import { MoleFood } from '../shared/types';

export class CodeWatcher implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private worker: Worker | null = null;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly onAnalysisComplete: (result: MoleFood) => void,
  ) {
    this.initWorker();

    const saveListener = vscode.workspace.onDidSaveTextDocument(
      async (document) => {
        await this.handleDocumentSave(document);
      },
    );

    this.disposables.push(saveListener);
  }

  private initWorker(): void {
    const workerUri = vscode.Uri.joinPath(
      this.context.extensionUri,
      'dist',
      'AccessibilityWorker.js',
    );

    this.worker = new Worker(workerUri.fsPath);

    this.worker.on('message', (result: MoleFood) => {
      this.onAnalysisComplete(result);
    });

    this.worker.on('error', (err) => {
      console.error('Accessibility Worker critical error:', err);
      this.relaunchWorker();
    });
  }

  private relaunchWorker(): void {
    if (this.worker) {
      this.worker.terminate();
    }
    this.initWorker();
  }

  private async handleDocumentSave(
    document: vscode.TextDocument,
  ): Promise<void> {
    const supportedLanguages = ['html', 'vue'];
    if (!supportedLanguages.includes(document.languageId)) {
      return;
    }

    let fileText = document.getText();
    const fileName = document.fileName.split('/').pop() || 'unknown';

    // If it's a Vue component, cut out the insides of the <template>
    if (document.languageId === 'vue') {
      const templateRegex = /<template[^>]*>(.*?)<\/template>/s;
      const match = fileText.match(templateRegex);

      const templateContent = match && match[1] ? match[1] : '';

      if (!templateContent.trim()) {
        return;
      }

      fileText = templateContent;
    }

    if (this.worker) {
      this.worker.postMessage({ sourceCode: fileText, fileName });
    }
  }

  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    if (this.worker) {
      this.worker.terminate();
    }
  }
}
