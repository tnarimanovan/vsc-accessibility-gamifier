export enum FoodType {
  SNACK = 'SNACK',
  LUNCH = 'LUNCH',
  DELICACY = 'DELICACY',
}

export interface FoodReward {
  xp: number;
  satiety: number;
}

export const FOOD_REWARDS: Record<FoodType, FoodReward> = {
  [FoodType.SNACK]: { xp: 5, satiety: 10 },
  [FoodType.LUNCH]: { xp: 20, satiety: 25 },
  [FoodType.DELICACY]: { xp: 50, satiety: 40 },
};

/**
 * Rule Mapping: Maps Axe-Core Rule IDs to our strategic game food matrix
 */

export const AXE_RULE_FOOD_MAP: Record<string, FoodType> = {
  // --- SNACKS (Basic semantic tags alignment) ---
  'image-alt': FoodType.SNACK,
  'html-has-lang': FoodType.SNACK,
  'document-title': FoodType.SNACK,
  'meta-viewport': FoodType.SNACK,
  'color-contrast': FoodType.SNACK,
  'valid-lang': FoodType.SNACK,

  // --- LUNCHES (Forms, inputs, and standard interactive element names) ---
  label: FoodType.LUNCH,
  'button-name': FoodType.LUNCH,
  'link-name': FoodType.LUNCH,
  'aria-roles': FoodType.LUNCH,
  'form-field-multiple-labels': FoodType.LUNCH,
  'input-image-alt': FoodType.LUNCH,

  // --- DELICACIES (Complex state containers and dynamic DOM operations) ---
  'aria-live-page-nav': FoodType.DELICACY,
  'scrollable-region-focus': FoodType.DELICACY,
  'aria-allowed-attr': FoodType.DELICACY,
  'aria-required-attr': FoodType.DELICACY,
  'aria-hidden-focus': FoodType.DELICACY,
  bypass: FoodType.DELICACY,
};
