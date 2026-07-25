/**
 * Global configurations for the Axe-Core audit loop runner
 */
export const AXE_PROFILES = {
  // Ultra-strict full audit matrix for standalone HTML documents
  html: {
    runOnly: {
      type: 'tag',
      values: [
        'wcag2a',
        'wcag2aa',
        'wcag2aaa',
        'wcag21a',
        'wcag21aa',
        'wcag22a', 
        'wcag22aa',
        'best-practice', 
        'cat.aria', 
        'cat.forms', 
        'cat.semantics', 
        'cat.structure', 
      ],
    },
    rules: {
      region: { enabled: true },
      'landmark-one-main': { enabled: true },
      'page-has-heading-one': { enabled: true },
      'heading-order': { enabled: true },
      'empty-heading': { enabled: true },
    },
  },

  // Full-featured component matrix for Vue Single File Components (SFC)
  vue: {
    runOnly: {
      type: 'tag',
      values: [
        'wcag2a',
        'wcag2aa',
        'wcag21a',
        'wcag21aa',
        'wcag22a',
        'wcag22aa',
        'best-practice',
        'cat.aria',
        'cat.forms',
        'cat.semantics',
      ],
    },
    rules: {
      'button-name': { exclude: ['component', 'slot'] },
      'link-name': { exclude: ['component', 'slot'] },
      'aria-roles': { enabled: false },
      region: { enabled: false }, 
      'document-title': { enabled: false }, 
      'html-has-lang': { enabled: false }, 
      'landmark-one-main': { enabled: false },
    },
  },
};

/**
 * Filter checks array used to prune global level accessibility faults from micro UI components
 */
const VUE_EXCLUDED_RULES = ['region', 'document-title', 'html-has-lang'];

export function filterViolationsByFileType(
  violations: any[],
  isVue: boolean,
): any[] {
  if (!isVue) {
    return violations;
  }
  // Strip out global context issues from Vue atom component analysis results
  return violations.filter((v) => !VUE_EXCLUDED_RULES.includes(v.id));
}
