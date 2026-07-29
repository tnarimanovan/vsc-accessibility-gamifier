import * as vscode from 'vscode';
import { fork, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { FoodType } from '../shared/food';
import { WorkerAnalysisResult, A11yErrorDetail } from '../shared/models';

export class CodeWatcher implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private workerProcess: ChildProcess | null = null;

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
   * Initializes background execution engine using child_process.fork
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

      this.workerProcess = fork(workerPath, [], {
        env: process.env,
        stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
      });

      // Listen to typed event triggers transmitted from the independent worker process
      this.workerProcess.on(
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

      this.workerProcess.on('error', (err) => {
        console.error('Accessibility Worker execution error:', err);
        this.relaunchWorker();
      });

      this.workerProcess.on('exit', (code) => {
        if (code !== 0) {
          console.warn(
            `Accessibility Worker stopped unexpectedly with code ${code}`,
          );
        }
      });
    } catch (err) {
      console.error(
        'Accessibility Failed to initialize child process worker:',
        err,
      );
    }
  }

  /**
   * Defensive self-healing pattern. Recovers operational tracking if process collapses.
   */
  private relaunchWorker(): void {
    if (this.workerProcess) {
      this.workerProcess.kill();
      this.workerProcess = null;
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

    if (!this.workerProcess) {
      this.initWorker();
    }

    if (this.workerProcess) {
      this.workerProcess.send({
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
    if (this.workerProcess) {
      this.workerProcess.kill();
      this.workerProcess = null;
    }
  }
}
