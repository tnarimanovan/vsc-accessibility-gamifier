import * as vscode from 'vscode';
import { GamificationEngine } from './core/GamificationEngine';
import { MoleWebviewPanel } from './presentation/MoleWebviewPanel';
import { MoleStatusBar } from './presentation/MoleStatusBar';
import { CodeWatcher } from './infrastructure/CodeWatcher';
import { GameState } from './shared/types';

const STORAGE_KEY = 'vsc-accessibility-gamifier.state';

// VISUAL DECORATION TYPE: Persistent decoration styles for accessibility errors
const errorLineDecorationType = vscode.window.createTextEditorDecorationType({
  backgroundColor: 'rgba(244, 67, 54, 0.08)', // Soft red whole-line shading
  isWholeLine: true,
  overviewRulerColor: 'rgba(244, 67, 54, 0.6)', // Red block marker on scrollbar track
  overviewRulerLane: vscode.OverviewRulerLane.Right,
});

export function activate(context: vscode.ExtensionContext) {
  let activePanel: MoleWebviewPanel | undefined = undefined;
  let hungerInterval: NodeJS.Timeout | undefined = undefined;
  const statusBar = new MoleStatusBar();

  // Reference register to cache line markers of the active session
  const errorsByFileCache: Record<string, number[]> = {};

  // Helper to safely push fresh errors into the webview component
  function syncPanelDiagnostics(fileName: string, errorLines: number[]) {
    if (
      activePanel &&
      typeof (activePanel as any).sendDocumentDiagnostics === 'function'
    ) {
      (activePanel as any).sendDocumentDiagnostics(fileName, errorLines);
    }
  }

  // 1. PERSISTENCE STORAGE LAYER: Recover saved state from VS Code storage engine
  const savedStateJson = context.globalState.get<string>(STORAGE_KEY);
  let restoredState: GameState | undefined = undefined;

  if (savedStateJson) {
    try {
      restoredState = JSON.parse(savedStateJson);
    } catch (e) {
      console.error(
        'Main state corrupted, attempting critical backup recovery protocol...',
        e,
      );

      // CRITICAL FALLBACK: Try to rescue the Mole from the immutable backup key
      const backupStateJson = context.globalState.get<string>(
        STORAGE_KEY + '.backup',
      );
      if (backupStateJson) {
        try {
          restoredState = JSON.parse(backupStateJson);
          vscode.window.showWarningMessage(
            'Mole progress file was corrupted, but we successfully restored your level from a backup!',
          );
        } catch (backupErr) {
          console.error(
            'Critical failure: Backup storage layer is also corrupted:',
            backupErr,
          );
          vscode.window.showErrorMessage(
            'Critical anomaly: All Mole burrow save files are corrupted.',
          );
        }
      }
    }
  }

  // 2. ENGINE COUPLING: Instantiate the engine with recovered state
  const engine = new GamificationEngine(
    restoredState,
    (updatedState, eventType) => {
      context.globalState.update(STORAGE_KEY, JSON.stringify(updatedState));
      statusBar.update(updatedState);
      // IRONCLAD PROTECTION: Create a hard backup snapshot specifically on milestones
      if (eventType === 'LEVEL_UP') {
        context.globalState.update(
          STORAGE_KEY + '.backup',
          JSON.stringify(updatedState),
        );
      }

      if (activePanel) {
        activePanel.updateGameState(updatedState);
      }

      handleEngineNotifications(updatedState, eventType);
    },
  );

  // 3. VISUAL ENGINE PIPELINE: Local orchestration
  function triggerCodeHighlighting() {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }

    const currentFileName =
      activeEditor.document.fileName.split(/[\\/]/).pop() || 'unknown';

    const config = vscode.workspace.getConfiguration('accessibilityMole');
    const isHighlightingEnabled = config.get<boolean>(
      'enableCodeHighlighting',
      true,
    );

    const fileErrorLines = errorsByFileCache[currentFileName] || [];

    if (!isHighlightingEnabled || fileErrorLines.length === 0) {
      activeEditor.setDecorations(errorLineDecorationType, []);
      return;
    }

    const decorations: vscode.DecorationOptions[] = [];
    const lineCount = activeEditor.document.lineCount;

    for (const lineIndex of fileErrorLines) {
      if (lineIndex < lineCount) {
        const range = activeEditor.document.lineAt(lineIndex).range;
        decorations.push({ range });
      }
    }

    activeEditor.setDecorations(errorLineDecorationType, decorations);
  }

  // 4. INFRASTRUCTURE PIPELINE: Connect CodeWatcher to Engine and ingest direct line coordinates
  const watcher = new CodeWatcher(
    context,
    (fileName, errorCount, fixedFoodType, errorLines) => {
      // Toggle on native spinner rendering inside status bar layout
      statusBar.setAnalyzing(true);

      engine.processCodeAnalysis(fileName, errorCount, fixedFoodType);

      const cleanLines = errorLines || [];
      errorsByFileCache[fileName] = cleanLines;

      triggerCodeHighlighting();
      syncPanelDiagnostics(fileName, cleanLines);

      // Release background compilation state flags
      statusBar.setAnalyzing(false);
    },
  );

  // 5. TIMER PIPELINE: Instantiate hunger ticker interval (fires every 10 minutes)
  let isEditorFocused = true;

  const windowFocusListener = vscode.window.onDidChangeWindowState(
    (windowState: vscode.WindowState) => {
      isEditorFocused = windowState.focused;
    },
  );

  const TEN_MINUTES_MS = 10 * 60 * 1000;

  hungerInterval = setInterval(() => {
    if (!isEditorFocused) {
      return;
    }
    engine.handleHungerTicker();
  }, TEN_MINUTES_MS);

  // Synchronize decorations when developer shifts tabs between workspace documents
  const activeEditorListener = vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (editor) {
        editor.setDecorations(errorLineDecorationType, []);
        triggerCodeHighlighting();

        const currentFileName =
          editor.document.fileName.split(/[\\/]/).pop() || 'unknown';
        syncPanelDiagnostics(
          currentFileName,
          errorsByFileCache[currentFileName] || [],
        );
      }
    },
  );

  // React instantly to runtime configuration changes sent from Webview panel toggle buttons
  const configListener = vscode.workspace.onDidChangeConfiguration((event) => {
    if (
      event.affectsConfiguration('accessibilityMole.enableCodeHighlighting')
    ) {
      triggerCodeHighlighting();
    }
  });

  // Listen to active keystroke inputs to flip the Mole status indicator
  const typingListener = vscode.workspace.onDidChangeTextDocument((event) => {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && event.document === activeEditor.document) {
      const supportedLanguages = ['html', 'vue'];
      if (supportedLanguages.includes(activeEditor.document.languageId)) {
        statusBar.triggerTypingState();
      }
    }
  });

  // Register command to manually reveal the Mole's Burrow panel view
  const openBurrowCommand = vscode.commands.registerCommand(
    'vsc-accessibility-gamifier.openBurrow',
    () => {
      if (activePanel) {
        activePanel.reveal();
      } else {
        activePanel = MoleWebviewPanel.create(context.extensionUri, () => {
          activePanel = undefined;
        });
        activePanel.updateGameState(engine.state);

        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
          const currentFileName =
            activeEditor.document.fileName.split(/[\\/]/).pop() || 'unknown';
          syncPanelDiagnostics(
            currentFileName,
            errorsByFileCache[currentFileName] || [],
          );
        }
      }
    },
  );

  // 6. RESOURCE CLEANUP: Track disposables to prevent memory leaks
  context.subscriptions.push(
    openBurrowCommand,
    watcher,
    statusBar,
    windowFocusListener,
    activeEditorListener,
    configListener,
    typingListener,
    errorLineDecorationType,
    {
      dispose: () => {
        if (hungerInterval) {
          clearInterval(hungerInterval);
        }
      },
    },
  );

  statusBar.update(engine.state);
}

function handleEngineNotifications(state: GameState, eventType: string): void {
  switch (eventType) {
    case 'LEVEL_UP':
      vscode.window.showInformationMessage(
        `Level Up! Your Mole evolved to Level ${state.level}! Check its new gear!`,
      );
      break;
  }
}

export function deactivate() {}
