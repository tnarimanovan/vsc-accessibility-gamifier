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
  // --- SNACKS (Basic semantic tags & minor rules) ---
  'image-alt': FoodType.SNACK,
  'html-has-lang': FoodType.SNACK,
  'document-title': FoodType.SNACK,
  'meta-viewport': FoodType.SNACK,
  'color-contrast': FoodType.SNACK,
  'valid-lang': FoodType.SNACK,
  'heading-order': FoodType.SNACK,
  'empty-heading': FoodType.SNACK,

  // --- LUNCHES (Forms, inputs, and standard interactive element names) ---
  label: FoodType.LUNCH,
  'button-name': FoodType.LUNCH,
  'link-name': FoodType.LUNCH,
  'aria-roles': FoodType.LUNCH,
  'form-field-multiple-labels': FoodType.LUNCH,
  'input-image-alt': FoodType.LUNCH,
  'page-has-heading-one': FoodType.LUNCH,

  // --- DELICACIES (Complex state containers, layout regions & landmarks) ---
  'aria-live-page-nav': FoodType.DELICACY,
  'scrollable-region-focus': FoodType.DELICACY,
  'aria-allowed-attr': FoodType.DELICACY,
  'aria-required-attr': FoodType.DELICACY,
  'aria-hidden-focus': FoodType.DELICACY,
  bypass: FoodType.DELICACY,
  region: FoodType.DELICACY,
  'landmark-one-main': FoodType.DELICACY,
  'landmark-unique': FoodType.DELICACY,
};

export function getFoodTypeForRule(
  ruleOrId: string | { id: string; impact?: string | null },
): FoodType {
  const ruleId = typeof ruleOrId === 'string' ? ruleOrId : ruleOrId.id;
  const impact = typeof ruleOrId === 'string' ? null : ruleOrId.impact;

  if (AXE_RULE_FOOD_MAP[ruleId]) {
    return AXE_RULE_FOOD_MAP[ruleId];
  }

  console.warn(
    `[AxeMapper] Rule "${ruleId}" is not in AXE_RULE_FOOD_MAP. Using impact fallback (${impact}).`,
  );

  switch (impact) {
    case 'critical':
      return FoodType.DELICACY;
    case 'serious':
      return FoodType.LUNCH;
    case 'moderate':
    case 'minor':
    default:
      return FoodType.SNACK;
  }
}
