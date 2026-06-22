/**
 * Global configurations for the Axe-Core audit loop runner
 */
export const AXE_PROFILES = {
  // Strict standard matrix configuration for pure native HTML files
  html: {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa'],
    },
    rules: {},
  },

  // Resilient decoupled layout configuration for Vue Single File Components (SFC)
  vue: {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa'],
    },
    rules: {
      // 1. Fully exclude custom layout abstractions (<component>, <Loader>, etc.) from interactive label validations
      'button-name': { exclude: ['component'] },
      'link-name': { exclude: ['component'] },
      'aria-roles': { enabled: false }, // Dynamic components resolve roles at production runtime execution

      // 2. Disable layout context constraints that make no sense inside micro UI Atoms templates
      region: { enabled: false }, // Bypasses <main>/<section> wrapper rules
      'document-title': { enabled: false }, // Micro templates do not hold global <title> descriptors
      'html-has-lang': { enabled: false }, // Global language tags are controlled at root index level
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
