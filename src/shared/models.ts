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
