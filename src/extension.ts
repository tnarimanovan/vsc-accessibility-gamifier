import * as vscode from 'vscode';
import { CodeWatcher } from './infrastructure/CodeWatcher';
import { MoleFood } from './shared/types';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "vsc-accessibility-gamifier" is now active!',
  );

  const onAnalysisComplete = (food: MoleFood) => {
    if (food.isEdible) {
      vscode.window.showInformationMessage(
        `The mole is full! Food found in ${food.fileName}. +${food.nutritionalValue} XP!`,
      );
    } else {
      vscode.window.showWarningMessage(
        `The mole is sad. В ${food.fileName} availability errors found: ${food.errorCount}`,
      );
    }
    // console.log('MoleFood Data:', food);
  };

  const codeWatcher = new CodeWatcher(context, onAnalysisComplete);

  context.subscriptions.push(codeWatcher);
}

// This method is called when your extension is deactivated
export function deactivate() {}
