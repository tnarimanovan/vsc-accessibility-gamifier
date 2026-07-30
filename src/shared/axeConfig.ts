export const AXE_PROFILES = {
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
        'cat.structure',
      ],
    },
    rules: {
      region: { enabled: false },
      'document-title': { enabled: false },
      'html-has-lang': { enabled: false },
      'landmark-one-main': { enabled: false },
      'page-has-heading-one': { enabled: false },
    },
  },
};

const VUE_EXCLUDED_RULES = [
  'region',
  'document-title',
  'html-has-lang',
  'landmark-one-main',
  'page-has-heading-one',
];

export function filterViolationsByFileType(
  violations: any[],
  isVue: boolean,
): any[] {
  if (!isVue) {
    return violations;
  }
  return violations.filter((v) => !VUE_EXCLUDED_RULES.includes(v.id));
}
