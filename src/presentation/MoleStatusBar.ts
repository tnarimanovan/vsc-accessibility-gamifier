import * as vscode from 'vscode';
import { GameState } from '../shared/types';

export class MoleStatusBar {
  private _statusBarItem: vscode.StatusBarItem;
  private _heartbeatInterval: NodeJS.Timeout | undefined;
  private _animationFrame = 0;
  private _lastState: GameState | undefined;

  // States orchestration flags
  private _isAnalyzing = false;
  private _isTyping = false;
  private _typingTimeout: NodeJS.Timeout | undefined;

  // Micro-events tracking parameters
  private _activeMicroEvent: string | null = null;
  private _microEventCountdown = 0;

  private _isHovered = false;
  private _hoverTimeout: NodeJS.Timeout | undefined;

  constructor() {
    // Priority 100 ensures high visibility alignment on the bottom left bar segment
    this._statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100,
    );
    this._statusBarItem.command = 'vsc-accessibility-gamifier.openBurrow';

    // HEARTBEAT: Core frame loop (fires every 3 seconds for tighter reactivity)
    this.startHeartbeat();
  }

  public setAnalyzing(analyzing: boolean): void {
    this._isAnalyzing = analyzing;
    this.refresh();
  }

  // TYPING REACTION: Instantly shift status bar state into active labor mode
  public triggerTypingState(): void {
    if (this._isAnalyzing) return; // Analysis spinner has higher visual priority

    this._isTyping = true;
    this.refresh();

    // Debounce structure: reset state back to idle after 2.5 seconds of silence
    if (this._typingTimeout) {
      clearTimeout(this._typingTimeout);
    }

    this._typingTimeout = setTimeout(() => {
      this._isTyping = false;
      this.refresh();
    }, 2500);
  }

  public update(state: GameState): void {
    this._lastState = state;
    this.refresh();
  }

  /**
   * Main render and orchestration pipeline separating state hierarchies
   */
  private refresh(): void {
    if (!this._lastState) return;

    let icon = '$(check-all)';
    let statusText = `Lv.${this._lastState.level}`;
    let color: vscode.ThemeColor | undefined = undefined;

    // RULE 1: Background compilation runner loop is active
    if (this._isAnalyzing) {
      icon = '$(sync~spin)';
      statusText = 'Analyzing...';
    }
    // RULE 2: Standard WCAG violations panic mode thresholds
    else if (this._lastState.errorCount > 0) {
      icon = '$(warning)';
      statusText = `${this._lastState.errorCount} Bug${this._lastState.errorCount > 1 ? 's' : ''}`;
      color = new vscode.ThemeColor('statusBarItem.errorForeground');
    }
    // RULE 3: Reactive typing feedback engagement layout
    else if (this._isTyping) {
      const laborFrames = ['$(tools)', '$(pencil)', '$(dashboard)'];
      icon = laborFrames[this._animationFrame % laborFrames.length];
      statusText = 'Writing markup...';
    }
    // RULE 4: Micro-Events execution processing layer
    else if (this._activeMicroEvent) {
      icon = '$(unmute)';
      statusText = this._activeMicroEvent;
      color = new vscode.ThemeColor('statusBarItem.warningForeground');
    }
    // RULE 5: Metabolic crash warnings parameters (Using your state.satiety)
    else if (this._lastState.satiety < 30) {
      icon = '$(heart)';
      statusText = `Hungry (${this._lastState.satiety}%)`;
      color = new vscode.ThemeColor('statusBarItem.warningForeground');
    }
    // RULE 6: Standard idle flow with energy glow multipliers animations (Using your state.combo)
    else if (this._lastState.combo && this._lastState.combo > 1.0) {
      const sparkFrames = ['$(zap)', '$(sparkle)', '$(flame)'];
      icon = sparkFrames[this._animationFrame % sparkFrames.length];
      statusText = `Clean x${this._lastState.combo.toFixed(1)}`;
    }

    this._statusBarItem.text = `🦫 Mole: ${icon} ${statusText}`;
    this._statusBarItem.color = color;

    if (!this._isHovered) {
      this._statusBarItem.tooltip = this.createTooltip(this._lastState);
    }

    this._statusBarItem.show();
  }

  private startHeartbeat(): void {
    this._heartbeatInterval = setInterval(() => {
      if (this._isHovered) {
        return;
      }

      this._animationFrame++;

      // MICRO-EVENTS TIMELINE PROCESSING: Handle active lifecycles or roll for new instances
      this.handleMicroEventsRolls();

      this.refresh();
    }, 3000);
  }

  /**
   * Evaluates pseudo-random probability loops to spike autonomous micro behaviors
   */
  private handleMicroEventsRolls(): void {
    if (this._activeMicroEvent) {
      this._microEventCountdown--;
      if (this._microEventCountdown <= 0) {
        this._activeMicroEvent = null;
      }
      return;
    }

    if (
      !this._lastState ||
      this._lastState.errorCount > 0 ||
      this._isTyping ||
      this._isAnalyzing
    ) {
      return;
    }

    const rollChance = Math.random() < 0.15;
    if (rollChance) {
      const liveEvents = [
        'Sipping coffee...',
        'Dusting the burrow...',
        'Sharpening paws...',
        'Yawning loudly...',
        'Checking blueprint...',
      ];
      this._activeMicroEvent =
        liveEvents[Math.floor(Math.random() * liveEvents.length)];
      this._microEventCountdown = 3;
    }
  }

  private getRandomContextualThought(state: GameState): string {
    if (this._isTyping) {
      return '"*intense stare*... Keep typing, human! I\'m ready to digest this markup structure!"';
    }
    if (this._activeMicroEvent) {
      return `\"Mole status report: Currently busy with [${this._activeMicroEvent}] inside the lower layers.\"`;
    }
    if (state.errorCount > 0) {
      return '"I can smell unmapped elements here. Someone completely forgot an interactive accessibility tag."';
    }
    if (state.satiety < 30) {
      return '"*stomach rumbling sounds*... Digestion engine running low on energy. Requesting a clean file check code block!"';
    }

    const cleanThoughts = [
      '"Absolute syntactic engineering brilliance. Not a single missing label found!"',
      '"Thinking about Italian class vocabulary... Code architecture is an international art."',
      '"Everything is perfectly clean down here. Sitting back and chilling."',
    ];
    return cleanThoughts[Math.floor(Math.random() * cleanThoughts.length)];
  }

  private createTooltip(state: GameState): vscode.MarkdownString {
    this._isHovered = true;

    if (this._hoverTimeout) {
      clearTimeout(this._hoverTimeout);
    }

    this._hoverTimeout = setTimeout(() => {
      this._isHovered = false;
    }, 5000);

    const thought = this.getRandomContextualThought(state);
    const comboSection =
      state.combo && state.combo > 1.0
        ? `• **Combo Multiplier:** 🔥 x${state.combo.toFixed(1)}\n`
        : '';

    const STAGE_NAMES: Record<number, string> = {
      1: 'Mole Intern',
      2: 'Junior Mole Dev',
      3: 'Senior Mole Dev',
      4: 'Accessibility Architect',
    };
    const stageName = STAGE_NAMES[state.stage] || 'Mole Intern';

    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.appendMarkdown(
      `### **Mole Companion Protocol**\n\n` +
        `> ${thought}\n\n` +
        `--- \n\n` +
        `• **Level Descriptor:** ${state.level} (${stageName})\n` +
        `• **Metabolic Tracker:** ${state.satiety}%\n` +
        `• **Unresolved Faults:** ${state.errorCount} active issues\n` +
        comboSection,
    );
    return md;
  }

  public dispose(): void {
    if (this._heartbeatInterval) clearInterval(this._heartbeatInterval);
    if (this._typingTimeout) clearTimeout(this._typingTimeout);
    if (this._hoverTimeout) clearTimeout(this._hoverTimeout);
    this._statusBarItem.dispose();
  }
}
