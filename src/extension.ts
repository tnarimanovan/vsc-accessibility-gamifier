import * as vscode from 'vscode';
import { GamificationEngine } from './core/GamificationEngine';
import { MoleWebviewPanel } from './presentation/MoleWebviewPanel';
import { MoleStatusBar } from './presentation/MoleStatusBar';
import { CodeWatcher } from './infrastructure/CodeWatcher';
import { GameState } from './shared/types';

const STORAGE_KEY = 'vsc-accessibility-gamifier.state';

export function activate(context: vscode.ExtensionContext) {
  let activePanel: MoleWebviewPanel | undefined = undefined;
  let hungerInterval: NodeJS.Timeout | undefined = undefined;
  const statusBar = new MoleStatusBar();

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

  // 3. INFRASTRUCTURE PIPELINE: Connect the real CodeWatcher to the Engine
  // It intercepts file saves and feeds real analytics straight to our game loop
  const watcher = new CodeWatcher(
    context,
    (fileName, errorCount, fixedFoodType) => {
      engine.processCodeAnalysis(fileName, errorCount, fixedFoodType);
    },
  );

  // 4. TIMER PIPELINE: Instantiate hunger ticker interval (fires every 10 minutes)

  // Track the native window focus state inside the OS environment
  let isEditorFocused = true;

  const windowFocusListener = vscode.window.onDidChangeWindowState(
    (windowState: vscode.WindowState) => {
      isEditorFocused = windowState.focused;
    },
  );

  // Scientifically grounded 10-minute interval execution loop (600,000 milliseconds)
  // Ensures the Mole changes state softly, requiring check-ins only 1-2 times per full workday
  const TEN_MINUTES_MS = 10 * 60 * 1000;

  hungerInterval = setInterval(() => {
    // STRICT GUARD CLAUSE: Freeze metabolic depletion if developer is working in browser or somewhere else
    if (!isEditorFocused) {
      return;
    }

    // Trigger decay only during active focus minutes
    engine.handleHungerTicker();
  }, TEN_MINUTES_MS);

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
      }
    },
  );

  // 5. RESOURCE CLEANUP: Track disposables to prevent memory leaks
  context.subscriptions.push(
    openBurrowCommand,
    watcher,
    statusBar,
    windowFocusListener, // Added focus listener wrapper to lifecycle context
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

/**
 * Orchestrates user facing notification popups based on engine domain events
 */
function handleEngineNotifications(state: GameState, eventType: string): void {
  switch (eventType) {
    case 'LEVEL_UP':
      vscode.window.showInformationMessage(
        `Level Up! Your Mole evolved to Level ${state.level}! Check its new gear!`,
      );
      break;

    case 'COMBO_BROKEN':
      vscode.window.showWarningMessage(
        `Perfect Run Broken! New accessibility errors were detected in ${state.fileName}. The combo multiplier has reset to x1.0.`,
      );
      break;
  }
}

export function deactivate() {}
