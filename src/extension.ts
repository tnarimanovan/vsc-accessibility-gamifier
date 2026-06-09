import * as vscode from 'vscode';
import { CodeWatcher } from './infrastructure/CodeWatcher';
import { MoleWebviewPanel } from './presentation/MoleWebviewPanel';
import { MoleFood } from './shared/types';

export function activate(context: vscode.ExtensionContext) {
  console.log(
    'Congratulations, your extension "vsc-accessibility-gamifier" is now active!',
  );

  let activePanel: MoleWebviewPanel | undefined = undefined;

  const onAnalysisComplete = (food: MoleFood) => {
    console.log('Food received in extension.ts:', food);

    if (!food.isEdible) {
      vscode.window.showWarningMessage(
        `The mole is sad. В ${food.fileName} availability errors found: ${food.errorCount}`,
      );
    }

    if (activePanel) {
      console.log('Sending message to active webview panel...');
      activePanel.updateGameState({
        level: 4,
        stage: 2,
        xp: 45,
        neededXp: 100,
        satiety: 75,
        fileName: food.fileName,
        errorCount: food.errorCount,
      });
    } else {
      console.log('Webview panel is NOT open right now.');
    }
  };

  const codeWatcher = new CodeWatcher(context, onAnalysisComplete);
  context.subscriptions.push(codeWatcher);
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'vsc-accessibility-gamifier.openMoleHome',
      () => {
        if (activePanel) {
          activePanel.reveal();
        } else {
          activePanel = MoleWebviewPanel.create(context.extensionUri, () => {
            activePanel = undefined;
          });
        }
      },
    ),
  );
}

export function deactivate() {}
