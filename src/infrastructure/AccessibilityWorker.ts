import { parentPort } from 'worker_threads';
import { JSDOM, VirtualConsole } from 'jsdom';
import { FoodType } from '../shared/types';
import { WorkerAnalysisResult } from './CodeWatcher';

// @ts-ignore
import axeCode from './axe.min.js';

const port = parentPort;
if (!port) {
  throw new Error('AccessibilityWorker must be initiated as a Worker Thread');
}

/**
 * Rule Mapping: Maps Axe-Core Rule IDs to our strategic game food matrix
 */
const AXE_RULE_FOOD_MAP: Record<string, FoodType> = {
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

// In-memory cache to keep track of previous violations per file inside this worker instance
const violationCache: Record<string, string[]> = {};

port.on(
  'message',
  async (message: { sourceCode: string; fileName: string }) => {
    const { sourceCode, fileName } = message;
    let dom: JSDOM | null = null;

    // Track previous cache records to avoid breaking FSM state cycles during crashes
    const previousViolations = violationCache[fileName] || [];

    try {
      const virtualConsole = new VirtualConsole();
      virtualConsole.on('jsdomError', (error) => {
        if (error.message.includes("HTMLCanvasElement's getContext")) {
          return;
        }
        console.error(error);
      });

      dom = new JSDOM(sourceCode, {
        runScripts: 'dangerously',
        pretendToBeVisual: false,
        virtualConsole,
        includeNodeLocations: true,
      });

      dom.window.eval(axeCode);

      // Execute Axe accessibility audit inside the virtual window environment
      const results = await dom.window.axe.run(dom.window.document, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa'],
        },
        preload: false,
      });

      // Map current violations to a clean string array of rule IDs
      const currentViolations = results.violations.map((v: any) => v.id);

      // LINE MARKERS EXTRACTION PIPELINE
      const errorLines: number[] = [];

      results.violations.forEach((violation: any) => {
        if (violation.nodes && Array.isArray(violation.nodes)) {
          violation.nodes.forEach((node: any) => {
            if (node.target && node.target[0]) {
              try {
                const element = dom!.window.document.querySelector(
                  node.target[0],
                );
                if (element) {
                  const location = dom!.nodeLocation(element);
                  if (location) {
                    // JSDOM uses 1-based indexing, VS Code expects 0-based index references
                    const vscodeLineIndex = location.startLine - 1;
                    if (!errorLines.includes(vscodeLineIndex)) {
                      errorLines.push(vscodeLineIndex);
                    }
                  }
                }
              } catch (selectorError) {
                console.error(
                  'Failed to resolve node location for target:',
                  node.target[0],
                  selectorError,
                );
              }
            }
          });
        }
      });

      let fixedFoodType: FoodType | undefined = undefined;

      // DELTA CHECK MECHANISM: Evaluate if the developer successfully eliminated a bug
      if (currentViolations.length < previousViolations.length) {
        // Find which specific rule ID was resolved since the last save checkpoint
        const resolvedRule = previousViolations.find(
          (id) => !currentViolations.includes(id),
        );

        if (resolvedRule) {
          // Identify the corresponding food item reward (fallback to SNACK if rule unknown)
          fixedFoodType = AXE_RULE_FOOD_MAP[resolvedRule] || FoodType.SNACK;
        }
      }

      // Sync current snapshot back into the cache register map
      violationCache[fileName] = currentViolations;

      const response: WorkerAnalysisResult & {
        isParsingError?: boolean;
        errorLines?: number[];
      } = {
        fileName,
        errorCount: currentViolations.length,
        fixedFoodType,
        errorLines,
        isParsingError: false,
      };

      port.postMessage(response);
    } catch (error) {
      console.warn(
        `[Fault-Tolerant Guardian] Broken markup or parsing crash caught for ${fileName}. Overlooking state cycle step.`,
      );

      // FAULT-TOLERANT ESCAPE ROUTE:
      // Instead of forcing errorCount: 1, mirror the historical cache length.
      // This ensures errorCount === previousErrors inside GamificationEngine, keeping combo streaks intact.
      const errorResponse: WorkerAnalysisResult & {
        isParsingError?: boolean;
        errorLines?: number[];
      } = {
        fileName,
        errorCount: previousViolations.length,
        fixedFoodType: undefined,
        errorLines: [],
        isParsingError: true,
      };

      port.postMessage(errorResponse);
    } finally {
      if (dom) {
        dom.window.close();
        dom = null;
      }
    }
  },
);
