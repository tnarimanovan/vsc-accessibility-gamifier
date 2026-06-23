import * as vscode from 'vscode';
import { GamificationEngine } from './core/GamificationEngine';
import { MoleWebviewPanel } from './presentation/MoleWebviewPanel';
import { MoleStatusBar } from './presentation/MoleStatusBar';
import { CodeWatcher } from './infrastructure/CodeWatcher';
import { GameState } from './shared/models';
import { GAME_BALANCE } from './shared/gameConstants';

const STORAGE_KEY = 'vsc-accessibility-gamifier.state';

// Global tracking reference for module lifecycle teardown
let hungerInterval: NodeJS.Timeout | undefined = undefined;

// VISUAL DECORATION TYPE: Persistent decoration styles for accessibility errors
const errorLineDecorationType = vscode.window.createTextEditorDecorationType({
  backgroundColor: 'rgba(244, 67, 54, 0.08)', // Soft red whole-line shading
  isWholeLine: true,
  overviewRulerColor: 'rgba(244, 67, 54, 0.6)', // Red block marker on scrollbar track
  overviewRulerLane: vscode.OverviewRulerLane.Right,
});

export function activate(context: vscode.ExtensionContext) {
  let activePanel: MoleWebviewPanel | undefined = undefined;
  const statusBar = new MoleStatusBar();

  // 0. ECO-MODE INITIALIZATION: Determine the true focus state at the exact moment of startup
  let isEditorFocused = vscode.window.state.focused;

  // Sync initial heartbeat lifecycle state right away
  if (!isEditorFocused) {
    statusBar.stopHeartbeat();
  }

  // Tracking human physical presence at the workstation
  let lastTypingTimestamp = Date.now();
  const TWENTY_MINUTES_MS = GAME_BALANCE.AFK_TIMEOUT_MS;

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

  // 2. ENGINE COUPLING: Instantiate the engine with recovered state & multi-window synchronization
  const engine = new GamificationEngine(
    restoredState,
    (updatedState, eventType) => {
      // SCENARIO 5: Fetch latest atomic disk cache values to evaluate multi-window save collisions
      const latestGlobalJson = context.globalState.get<string>(STORAGE_KEY);
      let finalState = updatedState;

      if (latestGlobalJson) {
        try {
          const externalState = JSON.parse(latestGlobalJson) as GameState;

          // Conflict Resolution: If another window pushed ahead, preserve maximum progression bounds
          if (
            externalState.level > updatedState.level ||
            (externalState.level === updatedState.level &&
              externalState.xp > updatedState.xp)
          ) {
            // Layer external values onto current tracking copy
            updatedState.level = externalState.level;
            updatedState.stage = externalState.stage;
            updatedState.xp = externalState.xp;
            updatedState.neededXp = externalState.neededXp;

            // Mutate runtime state registers directly inside the engine instance
            engine.state.level = externalState.level;
            engine.state.stage = externalState.stage;
            engine.state.xp = externalState.xp;
            engine.state.neededXp = externalState.neededXp;

            finalState = updatedState;
          }
        } catch (e) {
          console.error('Failed to resolve multi-window collision state:', e);
        }
      }

      // Write merged, collision-protected progression state block back into deep storage
      context.globalState.update(STORAGE_KEY, JSON.stringify(finalState));
      statusBar.update(finalState);

      // IRONCLAD PROTECTION: Create a hard backup snapshot specifically on milestones
      if (eventType === 'LEVEL_UP') {
        context.globalState.update(
          STORAGE_KEY + '.backup',
          JSON.stringify(finalState),
        );
      }

      if (activePanel) {
        activePanel.updateGameState(finalState);
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

  // 4. INFRASTRUCTURE PIPELINE: Connect CodeWatcher to Engine with lazy-evaluation on unfocused stabs
  const watcher = new CodeWatcher(
    context,
    (fileName, errorCount, fixedFoodType, errorLines) => {
      // Skip code evaluation ticks if the IDE is out of focus entirely
      if (!isEditorFocused) {
        return;
      }

      // Throttling watch execution if current file exceeds processing capacity bounds
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor && activeEditor.document.lineCount > 3000) {
        return;
      }

      statusBar.setAnalyzing(true);

      try {
        engine.processCodeAnalysis(fileName, errorCount, fixedFoodType);

        const cleanLines = errorLines || [];
        errorsByFileCache[fileName] = cleanLines;

        triggerCodeHighlighting();

        // Throttle diagnostic packet streams behind panel focus visibility constraints
        if (activePanel && activePanel.isVisible()) {
          syncPanelDiagnostics(fileName, cleanLines);
        }
      } catch (error) {
        console.error(
          'CRITICAL: Accessibility background analysis worker crashed:',
          error,
        );
      } finally {
        statusBar.setAnalyzing(false);
      }
    },
  );

  // 5. TIMER PIPELINE: Window focus orchestrator controlling background threads entirely
  const windowFocusListener = vscode.window.onDidChangeWindowState(
    (windowState: vscode.WindowState) => {
      isEditorFocused = windowState.focused;
      if (isEditorFocused) {
        statusBar.startHeartbeat();
        statusBar.refresh();

        // Trigger a lazy-sync of decorations upon user return to ensure consistency
        triggerCodeHighlighting();
      } else {
        statusBar.stopHeartbeat();
      }
    },
  );

  const TEN_MINUTES_MS = GAME_BALANCE.HUNGER_DECAY_INTERVAL_MS;

  hungerInterval = setInterval(() => {
    if (!isEditorFocused) {
      return; // Absolute metabolic degradation freeze lock
    }

    // AFK Protection Gate evaluating user presence
    const timeSinceLastKeystroke = Date.now() - lastTypingTimestamp;
    if (timeSinceLastKeystroke > TWENTY_MINUTES_MS) {
      console.log(
        '🔗 [AFK Protection]: Developer is away from keyboard. Hunger ticker frozen.',
      );
      return;
    }

    engine.handleHungerTicker();
  }, TEN_MINUTES_MS);

  // Synchronize decorations and companion states when developer shifts tabs between workspace documents
  const activeEditorListener = vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (!isEditorFocused) return; // Ignore tracking updates while window remains in cold background cache

      // SCENARIO 2: Zero tabs open layout (Empty workspace window view)
      if (!editor) {
        // Safe reset: clear highlights and force the engine back into a clean idle state
        engine.processCodeAnalysis('none', 0, undefined);
        statusBar.update(engine.state);
        return;
      }

      const supportedLanguages = ['html', 'vue'];
      const currentLanguageId = editor.document.languageId;

      // SCENARIO 1: Switching to unsupported development files (e.g., .css, .json, .ts)
      if (!supportedLanguages.includes(currentLanguageId)) {
        // Remove existing red lines decoration layer from the view first
        editor.setDecorations(errorLineDecorationType, []);

        // Force-sync state into 0 bugs to shift the Mole into a peaceful resting state
        const fallbackName =
          editor.document.fileName.split(/[\\/]/).pop() || 'unknown';
        engine.processCodeAnalysis(fallbackName, 0, undefined);
        statusBar.update(engine.state);
        return;
      }

      // STANDARD SUPPORTED FLOW: HTML/Vue file is in focus
      editor.setDecorations(errorLineDecorationType, []);

      // Handle large/generated validation protection bounds contextually
      if (editor.document.lineCount > 3000) {
        const giantFileName =
          editor.document.fileName.split(/[\\/]/).pop() || 'unknown';

        engine.processCodeAnalysis(
          `${giantFileName} (Too Deep!)`,
          0,
          undefined,
        );
        statusBar.update(engine.state);

        vscode.window.showWarningMessage(
          `🚧 This file is too deep (${editor.document.lineCount} lines)! The Mole refuses to dig here to save CPU resources.`,
        );

        if (activePanel) {
          activePanel.updateGameState(engine.state);
        }
        return;
      }

      triggerCodeHighlighting();

      const currentFileName =
        editor.document.fileName.split(/[\\/]/).pop() || 'unknown';

      // Request matching cached values or fallback to empty state
      const cachedFileLines = errorsByFileCache[currentFileName] || [];

      // Update engine error count state based on current cache before syncing UI
      engine.processCodeAnalysis(
        currentFileName,
        cachedFileLines.length,
        undefined,
      );
      statusBar.update(engine.state);

      if (activePanel) {
        activePanel.updateGameState(engine.state);
        syncPanelDiagnostics(currentFileName, cachedFileLines);
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

  // Listen to active keystroke inputs to flip the Mole status indicator and sync presence markers
  const typingListener = vscode.workspace.onDidChangeTextDocument((event) => {
    if (!isEditorFocused) return;

    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && event.document === activeEditor.document) {
      const supportedLanguages = ['html', 'vue'];
      if (supportedLanguages.includes(activeEditor.document.languageId)) {
        // Sync timestamp values immediately upon user keystrokes to prove physical activity
        lastTypingTimestamp = Date.now();
        statusBar.triggerTypingState();
      }
    }
  });

  const forceSyncData = () => {
    if (!activePanel) return;
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
  };

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

        forceSyncData();
      }
    },
  );

  // Serializer
  if (typeof vscode.window.registerWebviewPanelSerializer === 'function') {
    vscode.window.registerWebviewPanelSerializer('moleHome', {
      async deserializeWebviewPanel(
        webviewPanel: vscode.WebviewPanel,
        _state: any,
      ) {
        activePanel = MoleWebviewPanel.revive(
          webviewPanel,
          context.extensionUri,
          () => {
            activePanel = undefined;
          },
        );

        forceSyncData();
      },
    });
  }

  const closeListener = vscode.workspace.onDidCloseTextDocument((document) => {
    const fileName = document.fileName.split(/[\\/]/).pop();
    if (fileName) {
      engine.clearFileHistory(fileName);

      // Также чистим кэш декораций, чтобы не хранить лишнее
      if (errorsByFileCache.hasOwnProperty(fileName)) {
        delete errorsByFileCache[fileName];
      }
    }
  });

  // 6. RESOURCE CLEANUP: Track disposables to prevent memory leaks
  context.subscriptions.push(
    openBurrowCommand,
    watcher,
    statusBar,
    windowFocusListener,
    activeEditorListener,
    configListener,
    typingListener,
    closeListener,
    errorLineDecorationType,
  );

  // Render initial status tick contextually
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

// 7. EXTENSION TEARDOWN MECHANICS: Explicit module-level garbage collection
export function deactivate() {
  if (hungerInterval) {
    clearInterval(hungerInterval);
    hungerInterval = undefined;
    console.log('Companion hunger metabolic interval cleared successfully.');
  }
}
