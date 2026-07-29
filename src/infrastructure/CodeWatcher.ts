import * as vscode from 'vscode';
import { Worker } from 'worker_threads';
import * as path from 'path';
import * as fs from 'fs';
import { FoodType } from '../shared/food';
import { WorkerAnalysisResult, A11yErrorDetail } from '../shared/models';

export class CodeWatcher implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private worker: Worker | null = null;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly onAnalysisComplete: (
      fileName: string,
      errorCount: number,
      fixedFoodType?: FoodType,
      errorLines?: number[],
      currentViolations?: string[],
      errorDetails?: A11yErrorDetail[],
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
    try {
      const workerPath = path.join(
        this.context.extensionPath,
        'dist',
        'AccessibilityWorker.js',
      );

      if (!fs.existsSync(workerPath)) {
        console.error(
          `[A11y Mole] Worker file not found at path: ${workerPath}`,
        );
        return;
      }

      this.worker = new Worker(workerPath);

      // Listen to typed event triggers transmitted from the sandboxed worker environment
      this.worker.on(
        'message',
        (
          result: WorkerAnalysisResult & { errorDetails?: A11yErrorDetail[] },
        ) => {
          this.onAnalysisComplete(
            result.fileName,
            result.errorCount,
            result.fixedFoodType,
            result.errorLines,
            result.currentViolations,
            result.errorDetails,
          );
        },
      );

      this.worker.on('error', (err) => {
        console.error('Accessibility Worker execution error:', err);
        this.relaunchWorker();
      });

      this.worker.on('exit', (code) => {
        if (code !== 0) {
          console.warn(
            `Accessibility Worker stopped unexpectedly with code ${code}`,
          );
        }
      });
    } catch (err) {
      console.error('Accessibility Failed to initialize worker thread:', err);
    }
  }

  /**
   * Defensive self-healing pattern. Recovers operational tracking if thread collapses.
   */
  private relaunchWorker(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.initWorker();
  }

  /**
   * Public entry point: trigger manual document analysis (e.g. on editor focus)
   */
  public async analyzeDocument(document: vscode.TextDocument): Promise<void> {
    await this.handleDocumentSave(document);
  }

  /**
   * Intercepts text payload, extracts template content for Vue SFCs, and dispatches to worker
   */
  private async handleDocumentSave(
    document: vscode.TextDocument,
  ): Promise<void> {
    const supportedLanguages = ['html', 'vue'];
    if (!supportedLanguages.includes(document.languageId)) {
      return;
    }

    let fileText = document.getText();
    const fileName = document.fileName.split(/[\\/]/).pop() || 'unknown';

    let lineOffset = 0;
    const isVue = document.languageId === 'vue';

    if (isVue) {
      const templateRegex = /<template[^>]*>(.*?)<\/template>/s;
      const match = fileText.match(templateRegex);

      if (match && match[1]) {
        const templateStartIndex = fileText.indexOf(match[1]);
        lineOffset =
          fileText.substring(0, templateStartIndex).split('\n').length - 1;
        fileText = match[1];
      } else {
        return;
      }
    }

    const cache = this.getCache();

    if (!this.worker) {
      this.initWorker();
    }

    if (this.worker) {
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
      this.worker = null;
    }
  }
}
