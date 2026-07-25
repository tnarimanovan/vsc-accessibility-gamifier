import {
  describe,
  beforeEach,
  it,
  expect,
  vi,
  type MockedFunction,
} from 'vitest';
import { GamificationEngine } from '../core/GamificationEngine.js';
import { GameState } from '../shared/models.js';
import { FOOD_REWARDS, FoodType } from '../shared/food.js';
import { GAME_BALANCE } from '../shared/gameConstants.js';

describe('GamificationEngine Pure Logic Suite', () => {
  let mockOnStateChange: MockedFunction<
    (state: GameState, eventType: string) => void
  >;
  let engine: GamificationEngine;

  const defaultInitialState: GameState = {
    level: 1,
    stage: 1,
    xp: 0,
    neededXp: 100,
    satiety: 100,
    combo: 1.0,
    errorCount: 0,
    fileName: 'test.html',
  };

  beforeEach(() => {
    mockOnStateChange = vi.fn<(state: GameState, eventType: string) => void>();
    engine = new GamificationEngine(defaultInitialState, mockOnStateChange);
  });

  describe('1. Encapsulation & Immutability', () => {
    it('should fallback to default initial state when undefined is passed', () => {
      const emptyEngine = new GamificationEngine(undefined, mockOnStateChange);

      expect(emptyEngine.state).toEqual({
        level: 1,
        stage: 1,
        xp: 0,
        neededXp: 100,
        satiety: 100,
        combo: 1.0,
        errorCount: 0,
        fileName: 'none',
      });
    });

    it('should return a snapshot copy on state getter to prevent direct mutations', () => {
      const stateCopy = engine.state;
      stateCopy.xp = 999;
      stateCopy.level = 99;

      expect(engine.state.xp).toBe(0);
      expect(engine.state.level).toBe(1);
    });
  });

  describe('2. Metabolic Hunger Lifecycle', () => {
    it('should decrement satiety by 1 and trigger SATIETY_DROP when above threshold', () => {
      engine.handleHungerTicker();

      expect(engine.state.satiety).toBe(99);
      expect(mockOnStateChange).toHaveBeenCalledWith(
        expect.objectContaining({ satiety: 99 }),
        'SATIETY_DROP',
      );
    });

    it('should emit MOLE_STARVING event when satiety falls below critical threshold', () => {
      const lowSatietyState: GameState = {
        ...defaultInitialState,
        satiety: GAME_BALANCE.STARVING_THRESHOLD,
      };
      const starvingEngine = new GamificationEngine(
        lowSatietyState,
        mockOnStateChange,
      );

      starvingEngine.handleHungerTicker();

      expect(starvingEngine.state.satiety).toBe(
        GAME_BALANCE.STARVING_THRESHOLD - 1,
      );
      expect(mockOnStateChange).toHaveBeenCalledWith(
        expect.anything(),
        'MOLE_STARVING',
      );
    });

    it('should clamp satiety at 0 and skip callbacks if already at 0', () => {
      const zeroSatietyState: GameState = {
        ...defaultInitialState,
        satiety: 0,
      };
      const emptyEngine = new GamificationEngine(
        zeroSatietyState,
        mockOnStateChange,
      );

      emptyEngine.handleHungerTicker();

      expect(emptyEngine.state.satiety).toBe(0);
      expect(mockOnStateChange).not.toHaveBeenCalled();
    });
  });

  describe('3. Code Analysis & Anti-Cheat System', () => {
    const fileName = 'Component.vue';

    it('should register initial error count baseline without triggering feed mechanics', () => {
      engine.processCodeAnalysis(fileName, 3);

      expect(engine.state.errorCount).toBe(3);
      expect(engine.state.xp).toBe(0);
      expect(mockOnStateChange).not.toHaveBeenCalled();
    });

    it('should award XP, update satiety, and advance combo when fixing errors below historical minimum', () => {
      // Step 1: Baseline set to 3 errors
      engine.processCodeAnalysis(fileName, 3);

      // Step 2: Fix 1 error (3 -> 2 errors)
      engine.processCodeAnalysis(fileName, 2, 'LUNCH' as FoodType);

      const reward = FOOD_REWARDS['LUNCH'];
      const expectedXp = Math.round(reward.xp * 1.0);

      expect(engine.state.xp).toBe(expectedXp);
      expect(engine.state.errorCount).toBe(2);
      expect(engine.state.combo).toBeGreaterThan(1.0);
      expect(mockOnStateChange).toHaveBeenCalledWith(
        expect.anything(),
        'MOLE_FED',
      );
    });

    it('[Anti-Cheat] should ignore XP farming if errors drop relative to previous save but remain >= historical minimum', () => {
      // Создаем абсолютно чистый State с errorCount: 0
      const freshState: GameState = {
        level: 1,
        stage: 1,
        xp: 0,
        neededXp: 100,
        satiety: 100,
        combo: 1.0,
        errorCount: 0,
        fileName: 'none',
      };

      const antiCheatEngine = new GamificationEngine(
        freshState,
        mockOnStateChange,
      );
      const testFile = 'antiCheatTest.vue';

      // 1. Устанавливаем исторический минимум в 1 ошибку (baseline)
      antiCheatEngine.processCodeAnalysis(testFile, 1);
      expect(antiCheatEngine.state.xp).toBe(0);

      // 2. Разработчик ломает код — 3 ошибки (previousErrors становится 3)
      antiCheatEngine.processCodeAnalysis(testFile, 3);
      expect(antiCheatEngine.state.xp).toBe(0);

      mockOnStateChange.mockClear();

      // 3. Разработчик "исправляет" с 3 до 2 ошибок (2 < 3, но 2 > 1 минимум)
      antiCheatEngine.processCodeAnalysis(testFile, 2, 'SNACK' as FoodType);

      // Anti-Cheat заблокировал начисление XP!
      expect(antiCheatEngine.state.xp).toBe(0);
      expect(mockOnStateChange).toHaveBeenCalledWith(
        expect.anything(),
        'MOLE_RESTING',
      );
    });

    it('should break combo multiplier when errors increase', () => {
      const comboState: GameState = {
        ...defaultInitialState,
        combo: 1.5,
        errorCount: 1,
      };
      const comboEngine = new GamificationEngine(comboState, mockOnStateChange);

      comboEngine.processCodeAnalysis(fileName, 1);

      comboEngine.processCodeAnalysis(fileName, 3);

      expect(comboEngine.state.combo).toBe(1.0);
      expect(mockOnStateChange).toHaveBeenCalledWith(
        expect.objectContaining({ combo: 1.0 }),
        'COMBO_BROKEN',
      );
    });

    it('should trigger CLEAN_MAINTAINED on clean consecutive compiles (0 -> 0 errors)', () => {
      engine.processCodeAnalysis(fileName, 0); // Baseline 0
      engine.processCodeAnalysis(fileName, 0); // Maintained 0

      expect(mockOnStateChange).toHaveBeenCalledWith(
        expect.anything(),
        'CLEAN_MAINTAINED',
      );
    });

    it('should maintain isolated error baselines across multiple files', () => {
      const fileA = 'FileA.html';
      const fileB = 'FileB.html';

      engine.processCodeAnalysis(fileA, 2);
      engine.processCodeAnalysis(fileB, 5);

      engine.processCodeAnalysis(fileB, 4, 'SNACK' as FoodType);

      expect(engine.state.xp).toBeGreaterThan(0);
      expect(mockOnStateChange).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: fileB }),
        'MOLE_FED',
      );
    });
  });

  describe('4. Progression & Level Up Cascade Logic', () => {
    it('should handle Level Up and scale needed XP exponentially', () => {
      const initialNeededXp = 40;
      const lowXpState: GameState = {
        ...defaultInitialState,
        level: 1,
        xp: 0,
        neededXp: initialNeededXp, // 40 XP
      };
      const levelEngine = new GamificationEngine(lowXpState, mockOnStateChange);

      levelEngine.processCodeAnalysis('test.html', 5);
      levelEngine.processCodeAnalysis('test.html', 0, 'DELICACY' as FoodType);

      const expectedNeededXp = Math.round(
        initialNeededXp * GAME_BALANCE.XP_GROWTH_MULTIPLIER,
      );

      expect(levelEngine.state.level).toBeGreaterThan(1);
      expect(levelEngine.state.neededXp).toBe(expectedNeededXp); // 48
      expect(mockOnStateChange).toHaveBeenCalledWith(
        expect.anything(),
        'LEVEL_UP',
      );
    });

    it('should handle multi-level cascade if XP yield exceeds multiple level bounds', () => {
      const cascadeState: GameState = {
        ...defaultInitialState,
        combo: 2.0,
        neededXp: 10,
      };
      const cascadeEngine = new GamificationEngine(
        cascadeState,
        mockOnStateChange,
      );

      cascadeEngine.processCodeAnalysis('cascade.html', 1);
      cascadeEngine.processCodeAnalysis(
        'cascade.html',
        0,
        'DELICACY' as FoodType,
      );

      expect(cascadeEngine.state.level).toBeGreaterThan(2);
      expect(mockOnStateChange).toHaveBeenCalledWith(
        expect.anything(),
        'LEVEL_UP',
      );
    });
  });

  describe('5. Memory Cleanup Protocol', () => {
    it('should clear stored file history on clearFileHistory invocation', () => {
      const fileName = 'Temporary.vue';

      // 1. Set baseline
      engine.processCodeAnalysis(fileName, 5);

      // 2. Clear history
      engine.clearFileHistory(fileName);

      // 3. Process same error count -> should treat as a NEW baseline
      engine.processCodeAnalysis(fileName, 5);

      expect(mockOnStateChange).not.toHaveBeenCalled();
    });
  });
});
