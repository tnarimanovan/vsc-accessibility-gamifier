import * as vscode from 'vscode';
import { Worker } from 'worker_threads';
import { FoodType } from '../shared/food';

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
      currentViolations?: string[],
    ) => void,
    private readonly getCache: () => Record<string, string[]>,
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
      // Direct pass-through: extraction operations are completed entirely inside the background thread
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

    // Line offset identifier initialization (defaults to zero for standard flat HTML)
    let lineOffset = 0;
    // Identify file type natively via VS Code workspace indicators
    const isVue = document.languageId === 'vue';

    // If it's a Vue SFC component, cleanly isolate the raw inside contents of the <template> node
    if (isVue) {
      const templateRegex = /<template[^>]*>(.*?)<\/template>/s;
      const match = fileText.match(templateRegex);

      if (match && match[1]) {
        // Find the absolute character index where the template content block begins
        const templateStartIndex = fileText.indexOf(match[1]);

        // Count how many newline symbols (\n) exist prior to the template contents.
        lineOffset =
          fileText.substring(0, templateStartIndex).split('\n').length - 1;

        fileText = match[1];
      } else {
        return;
      }
    }
    const cache = this.getCache();
    if (this.worker) {
      // Offload processing intensive HTML parsing operations with strict architectural metrics
      this.worker.postMessage({
        sourceCode: fileText,
        fileName,
        previousViolations: cache[fileName] || [],
        lineOffset,
        isVue,
      });
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
