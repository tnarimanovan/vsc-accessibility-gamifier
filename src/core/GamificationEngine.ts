import { GameState, FoodType, FOOD_REWARDS } from '../shared/types';

export class GamificationEngine {
  private _state: GameState;
  private readonly _onStateChange: (
    state: GameState,
    eventType: string,
  ) => void;

  private _fileErrorMinima: Record<string, number> = {};

  constructor(
    initialState: GameState | undefined,
    onStateChange: (state: GameState, eventType: string) => void,
  ) {
    this._onStateChange = onStateChange;

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

  public get state(): GameState {
    return { ...this._state };
  }

  public handleHungerTicker(): void {
    if (this._state.satiety > 0) {
      this._state.satiety = Math.max(0, this._state.satiety - 1);

      const eventType =
        this._state.satiety < 30 ? 'MOLE_STARVING' : 'SATIETY_DROP';
      this._onStateChange(this.state, eventType);
    }
  }

  public processCodeAnalysis(
    fileName: string,
    currentErrors: number,
    fixedFoodType?: FoodType,
  ): void {
    this._state.fileName = fileName;
    const previousErrors = this._state.errorCount;
    this._state.errorCount = currentErrors;

    if (this._fileErrorMinima[fileName] === undefined) {
      this._fileErrorMinima[fileName] = previousErrors;
    }

    // SCENARIO 1: Errors were eliminated completely or partially fixed (Mole Feeds)
    if (currentErrors < previousErrors && fixedFoodType) {
      if (currentErrors < this._fileErrorMinima[fileName]) {
        this._fileErrorMinima[fileName] = currentErrors;
        this.feedMole(fixedFoodType);
      } else {
        this._onStateChange(this.state, 'MOLE_RESTING');
      }
      return;
    }

    // SCENARIO 2: New accessibility errors introduced or outstanding bugs ignored
    if (currentErrors > 0) {
      let eventType = 'STAGNANT_ERRORS';

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

  private feedMole(food: FoodType): void {
    const reward = FOOD_REWARDS[food];
    const calculatedXpGain = Math.round(reward.xp * this._state.combo);

    this._state.xp += calculatedXpGain;
    this._state.satiety = Math.min(100, this._state.satiety + reward.satiety);

    this.advanceComboCounter();

    let eventType = 'MOLE_FED';

    if (this._state.xp >= this._state.neededXp) {
      while (this._state.xp >= this._state.neededXp) {
        this.executeLevelUp();
      }
      eventType = 'LEVEL_UP';
    }

    this._onStateChange(this.state, eventType);
  }

  private advanceComboCounter(): void {
    if (this._state.combo === 1.0) this._state.combo = 1.2;
    else if (this._state.combo === 1.2) this._state.combo = 1.5;
    else if (this._state.combo === 1.5) this._state.combo = 2.0;
  }

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
