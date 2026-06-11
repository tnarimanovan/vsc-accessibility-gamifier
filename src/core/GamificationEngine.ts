import { GameState, FoodType, FOOD_REWARDS } from '../shared/types';

export class GamificationEngine {
  private _state: GameState;
  private readonly _onStateChange: (
    state: GameState,
    eventType: string,
  ) => void;

  constructor(
    initialState: GameState | undefined,
    onStateChange: (state: GameState, eventType: string) => void,
  ) {
    this._onStateChange = onStateChange;

    // Fallback default state if no saved state is recovered from VS Code globalState
    this._state = initialState || {
      level: 1,
      stage: 1,
      xp: 0,
      neededXp: 100,
      satiety: 100,
      combo: 1.0,
      errorCount: 0,
      fileName: 'none',
    };
  }

  /**
   * Returns a copy of the current game state (Encapsulation protection)
   */
  public get state(): GameState {
    return { ...this._state };
  }

  /**
   * Passive hunger simulation ticker. Decreases satiety by 1 point.
   * Expected to be called by an external interval timer every 5 minutes.
   */
  public handleHungerTicker(): void {
    if (this._state.satiety > 0) {
      this._state.satiety = Math.max(0, this._state.satiety - 1);
      this._onStateChange(this.state, 'SATIETY_DROP');
    }
  }

  /**
   * Main pipeline processing analysis results from the workspace code watcher
   */
  public processCodeAnalysis(
    fileName: string,
    currentErrors: number,
    fixedFoodType?: FoodType,
  ): void {
    this._state.fileName = fileName;
    const previousErrors = this._state.errorCount;
    this._state.errorCount = currentErrors;

    // SCENARIO 1: Errors were eliminated completely or partially fixed (Mole Feeds)
    if (currentErrors < previousErrors && fixedFoodType) {
      this.feedMole(fixedFoodType);
      return;
    }

    // SCENARIO 2: New accessibility errors introduced or outstanding bugs ignored
    if (currentErrors > 0) {
      let eventType = 'STAGNANT_ERRORS';

      // If combo run is currently active and new errors occur -> Break the Perfect Run Combo
      if (this._state.combo > 1.0) {
        this._state.combo = 1.0;
        eventType = 'COMBO_BROKEN';
      }

      this._onStateChange(this.state, eventType);
      return;
    }

    // SCENARIO 3: Code remained clean with zero errors on standard compile saves
    if (currentErrors === 0 && previousErrors === 0) {
      this._onStateChange(this.state, 'CLEAN_MAINTAINED');
    }
  }

  /**
   * Internal mechanism managing XP multiplication, level upgrades, and satiety limits
   */
  private feedMole(food: FoodType): void {
    const reward = FOOD_REWARDS[food];

    // Calculate final combo-multiplied XP gain
    const calculatedXpGain = Math.round(reward.xp * this._state.combo);

    this._state.xp += calculatedXpGain;
    this._state.satiety = Math.min(100, this._state.satiety + reward.satiety);

    // Progress the Perfect Run Multiplier combo step up
    this.advanceComboCounter();

    let eventType = 'MOLE_FED';

    // Handle Level Up checkpoint conditions
    if (this._state.xp >= this._state.neededXp) {
      this.executeLevelUp();
      eventType = 'LEVEL_UP';
    }

    this._onStateChange(this.state, eventType);
  }

  /**
   * Steps up the multiplier run index: x1.0 -> x1.2 -> x1.5 -> x2.0 (Max standard cap)
   */
  private advanceComboCounter(): void {
    if (this._state.combo === 1.0) this._state.combo = 1.2;
    else if (this._state.combo === 1.2) this._state.combo = 1.5;
    else if (this._state.combo === 1.5) this._state.combo = 2.0;
  }

  /**
   * Resets experience remainder tokens and increments levels + evolution thresholds
   */
  private executeLevelUp(): void {
    this._state.level += 1;
    this._state.xp = Math.max(0, this._state.xp - this._state.neededXp);

    // Progressive difficulty formula: Every level demands 20% more XP than the previous one
    this._state.neededXp = Math.round(this._state.neededXp * 1.2);

    // Calculate structural evolution milestones (Your 4 Stages Plan)
    if (this._state.level >= 13) {
      this._state.stage = 4; // Accessibility Architect
    } else if (this._state.level >= 8) {
      this._state.stage = 3; // Senior Mole Dev
    } else if (this._state.level >= 4) {
      this._state.stage = 2; // Junior Mole Dev
    } else {
      this._state.stage = 1; // Mole Intern
    }
  }
}
