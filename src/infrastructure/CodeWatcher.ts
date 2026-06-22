import * as vscode from 'vscode';
import { Worker } from 'worker_threads';
import { FoodType } from '../shared/types';

/**
 * Defines the structural payload contract emitted from the background Accessibility worker thread
 */
export interface WorkerAnalysisResult {
  fileName: string;
  errorCount: number;
  fixedFoodType?: FoodType; // Populated if an accessibility correction rule was successfully applied
  errorLines?: number[]; // Precise code rows coordinates containing violations
}

export class CodeWatcher implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private worker: Worker | null = null;

  constructor(
    private readonly context: vscode.ExtensionContext,
    // Callback updated to emit decoupled analytical primitives straight to the pipeline orchestration layers
    private readonly onAnalysisComplete: (
      fileName: string,
      errorCount: number,
      fixedFoodType?: FoodType,
      errorLines?: number[],
    ) => void,
  ) {
    this.initWorker();

    const saveListener = vscode.workspace.onDidSaveTextDocument(
      async (document) => {
        await this.handleDocumentSave(document);
      },
    );

    this.disposables.push(saveListener);
  }

  /**
   * Initializes background thread execution engine using Node.js Worker Threads
   */
  private initWorker(): void {
    const workerUri = vscode.Uri.joinPath(
      this.context.extensionUri,
      'dist',
      'AccessibilityWorker.js',
    );

    this.worker = new Worker(workerUri.fsPath);

    // Listen to typed event triggers transmitted from the sandboxed worker environment
    this.worker.on('message', (result: WorkerAnalysisResult) => {
      this.onAnalysisComplete(
        result.fileName,
        result.errorCount,
        result.fixedFoodType,
        result.errorLines,
      );
    });

    this.worker.on('error', (err) => {
      console.error('Accessibility Worker critical crash anomaly caught:', err);
      this.relaunchWorker();
    });
  }

  /**
   * Defensive self-healing pattern. Recovers operational tracking if thread collapses.
   */
  private relaunchWorker(): void {
    if (this.worker) {
      this.worker.terminate();
    }
    this.initWorker();
  }

  /**
   * Intercepts workspace save callbacks, parses out target text payloads, and sends tasks to the worker thread
   */
  private async handleDocumentSave(
    document: vscode.TextDocument,
  ): Promise<void> {
    const supportedLanguages = ['html', 'vue'];
    if (!supportedLanguages.includes(document.languageId)) {
      return;
    }

    let fileText = document.getText();
    // Cross-platform safe filename separation mechanism
    const fileName = document.fileName.split(/[\\/]/).pop() || 'unknown';

    // If it's a Vue SFC component, cleanly isolate the raw inside contents of the <template> node
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
      // Offload processing intensive HTML parsing operations to the auxiliary thread
      this.worker.postMessage({ sourceCode: fileText, fileName });
    }
  }

  /**
   * Clean resources allocation hooks to guarantee memory optimization on extension shutdown
   */
  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    if (this.worker) {
      this.worker.terminate();
    }
  }
}
