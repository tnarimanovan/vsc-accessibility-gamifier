import * as vscode from 'vscode';
import { GameState } from '../shared/types';

const MOLE_ICONS = {
  NORMAL: '⛏️',
  PANIC: '🛑',
  HUNGRY: '🤤',
  AVATAR: '🦫',
} as const;

export class MoleStatusBar {
  private _statusBarItem: vscode.StatusBarItem;

  constructor() {
    // Priority 100 ensures high visibility alignment on the bottom left bar segment
    this._statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100,
    );
    this._statusBarItem.command = 'vsc-accessibility-gamifier.openBurrow';
  }

  /**
   * Synchronizes status bar indicators dynamically with the core game telemetry state
   */
  public update(state: GameState): void {
    type MoleIconType = (typeof MOLE_ICONS)[keyof typeof MOLE_ICONS];
    let icon: MoleIconType = MOLE_ICONS.NORMAL;
    let text = `Lv.${state.level}`;
    let color: vscode.ThemeColor | undefined = undefined;

    // 1: Active source code file contains open WCAG violations (Panic mode)
    if (state.errorCount > 0) {
      icon = MOLE_ICONS.PANIC;
      text = `${state.errorCount} Bug${state.errorCount > 1 ? 's' : ''}`;
      color = new vscode.ThemeColor('statusBarItem.errorForeground');
    }
    // 2: Satiety thresholds breached (Hunger warning mode)
    else if (state.satiety < 30) {
      icon = MOLE_ICONS.HUNGRY;
      text = `${state.satiety}%`;
      color = new vscode.ThemeColor('statusBarItem.warningForeground');
    }
    // 3: Workspace is clean, Mole is satisfied (Productive flow state)
    else {
      icon = MOLE_ICONS.NORMAL;
      text = `Lv.${state.level}`;
    }

    this._statusBarItem.text = `${icon} ${MOLE_ICONS.AVATAR} ${text}`;
    this._statusBarItem.color = color;
    this._statusBarItem.tooltip = this.createTooltip(state);
    this._statusBarItem.show();
  }

  /**
   * Compiles interactive descriptive metadata tooltips via Markdown string mapping
   */
  private createTooltip(state: GameState): vscode.MarkdownString {
    return new vscode.MarkdownString(
      `**Mole's Burrow**\n\n` +
        `• **Level:** ${state.level}\n` +
        `• **Satiety:** ${state.satiety}%\n` +
        `• **Current Errors:** ${state.errorCount}\n\n` +
        `*Click to open Mole's Burrow panel*`,
    );
  }

  /**
   * Memory management hook to prevent memory leaks during extension lifecycle termination
   */
  public dispose(): void {
    this._statusBarItem.dispose();
  }
}
