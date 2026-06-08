export interface MoleFood {
  isEdible: boolean;                // Is it possible to feed a mole with this (true if there are 0 availability errors)
  nutritionalValue: number;         // Nutritional value (for example, how much XP this worm will give)
  errorCount: number;               // How many "stones" (errors) did axe-core find?
  warningCount: number;             // How many warnings
  fileName: string;                  // The name of the file where the food was found
  timestamp: number;                // Feeding time
}
