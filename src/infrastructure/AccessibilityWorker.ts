import { parentPort } from 'worker_threads';
import { JSDOM, VirtualConsole } from 'jsdom';
import { WorkerAnalysisResult, A11yErrorDetail } from '../shared/models';
import { AXE_PROFILES, filterViolationsByFileType } from '../shared/axeConfig';
import { FoodType, getFoodTypeForRule } from '../shared/food';

// @ts-ignore
import axeCode from './axe.min.js';

const port = parentPort;
if (!port) {
  throw new Error('AccessibilityWorker must be initiated as a Worker Thread');
}

port.on(
  'message',
  async (message: {
    sourceCode: string;
    fileName: string;
    previousViolations: string[];
    lineOffset?: number;
    isVue?: boolean;
  }) => {
    const {
      sourceCode,
      fileName,
      previousViolations = [],
      lineOffset = 0,
      isVue = false,
    } = message;

    let dom: JSDOM | null = null;

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

      // 1. DYNAMIC PROFILE INJECTION: Select configuration matrix profile cleanly
      const currentConfigProfile = isVue ? AXE_PROFILES.vue : AXE_PROFILES.html;

      // Execute Axe accessibility audit inside the virtual window environment
      const results = await dom.window.axe.run(dom.window.document, {
        ...currentConfigProfile,
        preload: false,
      });

      // 2. ADAPTIVE FILTERING CHAIN: Leverage configuration predicates to isolate errors
      const activeViolations = filterViolationsByFileType(
        results.violations,
        isVue,
      );
      const currentViolations = activeViolations.map((v: any) => v.id);
      const totalErrorNodesCount = activeViolations.reduce(
        (sum: number, v: any) => sum + (v.nodes?.length || 1),
        0,
      );

      // LINE MARKERS & DETAILED ERRORS EXTRACTION PIPELINE
      const errorLines: number[] = [];
      const errorDetails: A11yErrorDetail[] = [];

      activeViolations.forEach((violation: any) => {
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
                    // JSDOM uses 1-based indexing, VS Code expects 0-based index references.
                    const vscodeLineIndex = location.startLine - 1 + lineOffset;

                    if (!errorLines.includes(vscodeLineIndex)) {
                      errorLines.push(vscodeLineIndex);
                    }

                    const primaryHelp =
                      violation.help || 'Accessibility issue detected';
                    const failureReason = node.failureSummary
                      ? node.failureSummary.replace(
                          /^Fix any of the following:\s*/,
                          '',
                        )
                      : '';

                    const fullMessage = failureReason
                      ? `${primaryHelp}. ${failureReason}`
                      : primaryHelp;

                    errorDetails.push({
                      line: vscodeLineIndex,
                      ruleId: violation.id,
                      message: fullMessage,
                      helpUrl: violation.helpUrl || '',
                    });
                  }
                }
              } catch (selectorError) {
                // Defensive strategy fallback for complex selectors
                if (isVue) {
                  const fallbackElement =
                    dom!.window.document.querySelector('component');
                  if (fallbackElement) {
                    const location = dom!.nodeLocation(fallbackElement);
                    if (location) {
                      const vscodeLineIndex =
                        location.startLine - 1 + lineOffset;
                      if (!errorLines.includes(vscodeLineIndex)) {
                        errorLines.push(vscodeLineIndex);
                      }

                      errorDetails.push({
                        line: vscodeLineIndex,
                        ruleId: violation.id,
                        message:
                          violation.help ||
                          'Accessibility issue detected in component',
                        helpUrl: violation.helpUrl || '',
                      });
                    }
                  }
                }
              }
            }
          });
        }
      });

      // DELTA CHECK MECHANISM: Evaluate if the developer successfully eliminated a bug
      let fixedFoodType: FoodType | undefined = undefined;
      if (currentViolations.length < previousViolations.length) {
        const resolvedRuleId = previousViolations.find(
          (id) => !currentViolations.includes(id),
        );

        if (resolvedRuleId) {
          fixedFoodType = getFoodTypeForRule(resolvedRuleId);
        }
      }

      // Sync current snapshot back into the cache register map
      const response: WorkerAnalysisResult & {
        isParsingError?: boolean;
        currentViolations: string[];
        errorLines?: number[];
        errorDetails?: A11yErrorDetail[];
      } = {
        fileName,
        errorCount: totalErrorNodesCount,
        fixedFoodType,
        errorLines,
        errorDetails,
        currentViolations,
        isParsingError: false,
      };

      port.postMessage(response);
    } catch (error) {
      console.warn(`[Fault-Tolerant Guardian] Error in ${fileName}.`);

      const errorResponse: WorkerAnalysisResult & {
        isParsingError?: boolean;
        errorLines?: number[];
        errorDetails?: A11yErrorDetail[];
        currentViolations: string[];
      } = {
        fileName,
        errorCount: previousViolations.length,
        fixedFoodType: undefined,
        errorLines: [],
        errorDetails: [],
        currentViolations: previousViolations,
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
