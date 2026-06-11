export interface GameState {
  level: number; // Current level (starts at 1)
  stage: number; // Evolution stage (1, 2, 3, or 4)
  xp: number; // Current experience points on the current level
  neededXp: number; // Total XP required to transition to the next level
  satiety: number; // Satiety index tracking bar (0 to 100)
  combo: number; // Current combo run multiplier (1.0, 1.2, 1.5, 2.0)
  errorCount: number; // Current open file accessibility error count
  fileName: string; // Active document name rendered inside the terminal view
}

/**
 * Categorization of available accessibility food items mapped to WCAG complexity
 */
export enum FoodType {
  SNACK = 'SNACK', // Basic tags alignment (e.g., image-alt, html-lang)
  LUNCH = 'LUNCH', // Interactive components semantics (e.g., label-input binds)
  DELICACY = 'DELICACY', // Complex engineering patterns (e.g., focus traps, aria-live)
}

/**
 * Definition structure for a specific food type payload reward
 */
export interface FoodReward {
  xp: number;
  satiety: number;
}

/**
 * Immutable configuration of game engine rewards matrix
 */
export const FOOD_REWARDS: Record<FoodType, FoodReward> = {
  [FoodType.SNACK]: { xp: 5, satiety: 10 },
  [FoodType.LUNCH]: { xp: 20, satiety: 25 },
  [FoodType.DELICACY]: { xp: 50, satiety: 40 },
};
