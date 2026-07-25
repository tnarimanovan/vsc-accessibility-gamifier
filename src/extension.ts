import * as vscode from 'vscode';
import { GamificationEngine } from './core/GamificationEngine';
import { MoleWebviewPanel } from './presentation/MoleWebviewPanel';
import { MoleStatusBar } from './presentation/MoleStatusBar';
import { CodeWatcher } from './infrastructure/CodeWatcher';
import { GameState } from './shared/models';
import { GAME_BALANCE } from './shared/gameConstants';

const STORAGE_KEY = 'vsc-accessibility-gamifier.state';

// VISUAL DECORATION TYPE: Persistent decoration styles for accessibility errors
const errorLineDecorationType = vscode.window.createTextEditorDecorationType({
  backgroundColor: 'rgba(244, 67, 54, 0.08)', // Soft red whole-line shading
  isWholeLine: true,
  overviewRulerColor: 'rgba(244, 67, 54, 0.6)', // Red block marker on scrollbar track
  overviewRulerLane: vscode.OverviewRulerLane.Right,
});

export function activate(context: vscode.ExtensionContext) {
  // SYSTEM TELEMETRY CHANNEL: Creating dedicated output channel for non-intrusive auditing
  const logChannel = vscode.window.createOutputChannel("Mole's Burrow Log");
  logChannel.appendLine('[System] Orchestrator successfully initialized.');

  let activePanel: MoleWebviewPanel | undefined = undefined;
  const statusBar = new MoleStatusBar();

  // 0. ECO-MODE INITIALIZATION: Determine the true focus state at the exact moment of startup
  let isEditorFocused = vscode.window.state.focused;

  // Sync initial heartbeat lifecycle state right away
  if (!isEditorFocused) {
    statusBar.stopHeartbeat();
  }

  let lastTypingTimestamp = Date.now();
  const TWENTY_MINUTES_MS = GAME_BALANCE.AFK_TIMEOUT_MS;
  const errorsByFileCache: Record<string, number[]> = {};

  function syncPanelDiagnostics(fileName: string, errorLines: number[]) {
    if (
      activePanel &&
      typeof (activePanel as any).sendDocumentDiagnostics === 'function'
    ) {
      (activePanel as any).sendDocumentDiagnostics(fileName, errorLines);
    }
  }

  // 1. PERSISTENCE STORAGE LAYER: Recover saved state with recovery fallbacks
  const savedStateJson = context.globalState.get<string>(STORAGE_KEY);
  let restoredState: GameState | undefined = undefined;

  if (savedStateJson) {
    try {
      restoredState = JSON.parse(savedStateJson);
    } catch (e) {
      logChannel.appendLine(
        '[Persistence] Main state corrupted. Initiating critical backup protocol...',
      );
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
          logChannel.appendLine(
            `[Critical] Backup layer corrupted: ${backupErr}`,
          );
          vscode.window.showErrorMessage(
            'Critical anomaly: All Mole burrow save files are corrupted.',
          );
        }
      }
    }
  }

  // 2. ENGINE COUPLING: Instantiate deterministic game core
  const engine = new GamificationEngine(
    restoredState,
    (updatedState, eventType) => {
      const latestGlobalJson = context.globalState.get<string>(STORAGE_KEY);
      let finalState = updatedState;

      if (latestGlobalJson) {
        try {
          const externalState = JSON.parse(latestGlobalJson) as GameState;
          if (
            externalState.level > updatedState.level ||
            (externalState.level === updatedState.level &&
              externalState.xp > updatedState.xp)
          ) {
            updatedState.level = externalState.level;
            updatedState.stage = externalState.stage;
            updatedState.xp = externalState.xp;
            updatedState.neededXp = externalState.neededXp;

            engine.state.level = externalState.level;
            engine.state.stage = externalState.stage;
            engine.state.xp = externalState.xp;
            engine.state.neededXp = externalState.neededXp;
            finalState = updatedState;
          }
        } catch (e) {
          logChannel.appendLine(`[Collision] Engine resolution error: ${e}`);
        }
      }

      context.globalState.update(STORAGE_KEY, JSON.stringify(finalState));
      statusBar.update(finalState);

      if (eventType === 'LEVEL_UP') {
        context.globalState.update(
          STORAGE_KEY + '.backup',
          JSON.stringify(finalState),
        );
        vscode.window.showInformationMessage(
          `Level Up! Your Mole evolved to Level ${finalState.level}!`,
        );
      }

      if (activePanel) {
        activePanel.updateGameState(finalState);
      }
    },
  );

  function triggerCodeHighlighting() {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) return;

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

  // 4. INFRASTRUCTURE PIPELINE: Connect Worker to Engine
  const watcher = new CodeWatcher(
    context,
    (fileName, errorCount, fixedFoodType, errorLines, currentViolations) => {
      if (!isEditorFocused) return;

      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor && activeEditor.document.lineCount > 3000) return;

      statusBar.setAnalyzing(true);
      logChannel.appendLine(
        `[Analysis] Processing trace signals for target file: ${fileName}`,
      );

      try {
        const cache =
          context.workspaceState.get<Record<string, string[]>>(
            'violationCache',
          ) || {};
        cache[fileName] = currentViolations || [];
        context.workspaceState.update('violationCache', cache);

        engine.processCodeAnalysis(fileName, errorCount, fixedFoodType);
        const cleanLines = errorLines || [];
        errorsByFileCache[fileName] = cleanLines;

        triggerCodeHighlighting();

        if (activePanel && activePanel.isVisible()) {
          syncPanelDiagnostics(fileName, cleanLines);
        }
      } catch (error) {
        logChannel.appendLine(`[Critical] Analysis runtime error: ${error}`);
      } finally {
        statusBar.setAnalyzing(false);
      }
    },
    () =>
      context.workspaceState.get<Record<string, string[]>>('violationCache') ||
      {},
  );

  // 5. TIMER PIPELINE: Focus listener and metabolic decay setup
  const windowFocusListener = vscode.window.onDidChangeWindowState(
    (windowState: vscode.WindowState) => {
      isEditorFocused = windowState.focused;
      logChannel.appendLine(
        `[System] Context shift. Window focused segment state = ${isEditorFocused}`,
      );
      if (isEditorFocused) {
        statusBar.startHeartbeat();
        statusBar.refresh();
        triggerCodeHighlighting();
      } else {
        statusBar.stopHeartbeat();
      }
    },
  );

  const TEN_MINUTES_MS = GAME_BALANCE.HUNGER_DECAY_INTERVAL_MS;
  const hungerTimerInstance = setInterval(() => {
    if (!isEditorFocused) return;

    const timeSinceLastKeystroke = Date.now() - lastTypingTimestamp;
    if (timeSinceLastKeystroke > TWENTY_MINUTES_MS) {
      logChannel.appendLine(
        '🔗 [AFK Protection]: Developer state idle. Hunger loop frozen.',
      );
      return;
    }
    engine.handleHungerTicker();
  }, TEN_MINUTES_MS);

  // ZERO LEAK MECHANIC: Explicitly wrapping interval into an automatic disposable registration scope
  const hungerTimerDisposable = new vscode.Disposable(() => {
    clearInterval(hungerTimerInstance);
    logChannel.appendLine(
      '[Teardown] Volatile metabolic engine interval garbage-collected.',
    );
  });

  const activeEditorListener = vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (!isEditorFocused) return;

      if (!editor) {
        engine.processCodeAnalysis('none', 0, undefined);
        statusBar.update(engine.state);
        return;
      }

      const supportedLanguages = ['html', 'vue'];
      const currentLanguageId = editor.document.languageId;

      if (!supportedLanguages.includes(currentLanguageId)) {
        editor.setDecorations(errorLineDecorationType, []);
        const fallbackName =
          editor.document.fileName.split(/[\\/]/).pop() || 'unknown';
        engine.processCodeAnalysis(fallbackName, 0, undefined);
        statusBar.update(engine.state);
        return;
      }

      editor.setDecorations(errorLineDecorationType, []);

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
          `File too deep (${editor.document.lineCount} lines)! Core analysis skipped to save CPU.`,
        );
        return;
      }

      triggerCodeHighlighting();
      const currentFileName =
        editor.document.fileName.split(/[\\/]/).pop() || 'unknown';
      const cachedFileLines = errorsByFileCache[currentFileName] || [];

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

  const configListener = vscode.workspace.onDidChangeConfiguration((event) => {
    if (
      event.affectsConfiguration('accessibilityMole.enableCodeHighlighting')
    ) {
      triggerCodeHighlighting();
    }
  });

  const typingListener = vscode.workspace.onDidChangeTextDocument((event) => {
    if (!isEditorFocused) return;
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && event.document === activeEditor.document) {
      if (['html', 'vue'].includes(activeEditor.document.languageId)) {
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
      if (errorsByFileCache.hasOwnProperty(fileName)) {
        delete errorsByFileCache[fileName];
      }
    }
  });

  // 6. RESOURCE CLEANUP REGISTRATION: All modules linked to root context tree
  context.subscriptions.push(
    logChannel,
    openBurrowCommand,
    watcher,
    statusBar,
    windowFocusListener,
    hungerTimerDisposable, // Fully safe garbage collection tracking registration
    activeEditorListener,
    configListener,
    typingListener,
    closeListener,
    errorLineDecorationType,
  );

  statusBar.update(engine.state);
}

export function deactivate() {
  // context.subscriptions automatically clean up everything registered above
}
