import {
  baseParse,
  NodeTypes,
  type ElementNode,
  type RootNode,
  type AttributeNode,
  type DirectiveNode,
} from '@vue/compiler-core';

import { A11yErrorDetail } from './models';

export function analyzeVueAst(
  template: string,
  lineOffset = 0,
): A11yErrorDetail[] {
  const errors: A11yErrorDetail[] = [];

  try {
    const ast: RootNode = baseParse(template);

    walk(ast);

    return errors;
  } catch (error) {
    console.warn('[Vue AST] Failed to parse template.', error);
    return [];
  }

  function walk(node: any): void {
    if (!node) return;

    if (node.type === NodeTypes.ELEMENT) {
      analyzeElement(node as ElementNode);
    }

    if (Array.isArray(node.children)) {
      node.children.forEach(walk);
    }

    if (Array.isArray(node.branches)) {
      node.branches.forEach(walk);
    }
  }

  function analyzeElement(element: ElementNode): void {
    const tag = element.tag.toLowerCase();

    //-----------------------------------------
    // Rule 1
    // @click on non-interactive element
    //-----------------------------------------

    const interactiveTags = new Set([
      'button',
      'a',
      'input',
      'select',
      'textarea',
      'option',
      'summary',
      'details',
    ]);

    if (!interactiveTags.has(tag)) {
      const hasClick = hasDirective(element, 'on', 'click');

      if (hasClick) {
        const hasKeyboard =
          hasDirective(element, 'on', 'keydown') ||
          hasDirective(element, 'on', 'keyup') ||
          hasDirective(element, 'on', 'keypress');

        const hasRoleButton = getAttribute(element, 'role') === 'button';

        const hasTabIndex = getAttribute(element, 'tabindex') !== undefined;

        if (!hasKeyboard || !hasRoleButton || !hasTabIndex) {
          errors.push({
            line: getLine(element),
            ruleId: 'vue-click-events-have-key-events',
            message:
              `Interactive behavior detected on <${tag}>. ` +
              `Elements with @click should also support keyboard interaction ` +
              `and expose role="button" tabindex="0".`,
            helpUrl:
              'https://dequeuniversity.com/rules/axe/4.10/click-events-have-key-events',
          });
        }
      }
    }
  }

  //-----------------------------------------
  // Helpers
  //-----------------------------------------

  function getLine(node: ElementNode): number {
    return node.loc.start.line - 1 + lineOffset;
  }

  function getAttribute(
    element: ElementNode,
    name: string,
  ): string | undefined {
    const attr = element.props.find(
      (prop) =>
        prop.type === NodeTypes.ATTRIBUTE &&
        (prop as AttributeNode).name === name,
    ) as AttributeNode | undefined;

    return attr?.value?.content;
  }

  function hasDirective(
    element: ElementNode,
    directive: string,
    argument?: string,
  ): boolean {
    return element.props.some((prop) => {
      if (prop.type !== NodeTypes.DIRECTIVE) {
        return false;
      }

      const dir = prop as DirectiveNode;

      if (dir.name !== directive) {
        return false;
      }

      if (!argument) {
        return true;
      }

      return (
        dir.arg?.type === NodeTypes.SIMPLE_EXPRESSION &&
        dir.arg.content === argument
      );
    });
  }
}
