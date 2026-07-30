import { JSDOM, VirtualConsole } from 'jsdom';
import { WorkerAnalysisResult, A11yErrorDetail } from '../shared/models';
import { AXE_PROFILES, filterViolationsByFileType } from '../shared/axeConfig';
import { FoodType, getFoodTypeForRule } from '../shared/food';
import { analyzeVueAst } from '../shared/vueAstAnalyzer';
import { sanitizeVueTemplate } from '../shared/sanitizeVueTemplate';

// @ts-ignore
import axeCode from './axe.min.js';

process.on(
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

      let htmlToParse = sourceCode;
      let astVueErrors: A11yErrorDetail[] = [];

      // ---------------------------------------------------------
      // pipeline VUE: AST Analyzer -> Sanitize -> wrap
      // ---------------------------------------------------------
      if (isVue) {

        astVueErrors = analyzeVueAst(sourceCode, lineOffset);
        const sanitized = sanitizeVueTemplate(sourceCode);
        htmlToParse = `<!DOCTYPE html><html lang="en"><head><title>Audit</title></head><body><main>${sanitized}</main></body></html>`;
      }

      dom = new JSDOM(htmlToParse, {
        runScripts: 'dangerously',
        pretendToBeVisual: false,
        virtualConsole,
        includeNodeLocations: true,
      });

      dom.window.eval(axeCode);

      const currentConfigProfile = isVue ? AXE_PROFILES.vue : AXE_PROFILES.html;

      const results = await dom.window.axe.run(dom.window.document, {
        ...currentConfigProfile,
        preload: false,
      });

      const activeViolations = filterViolationsByFileType(
        results.violations,
        isVue,
      );

      const axeErrorDetails: A11yErrorDetail[] = [];

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
                    const vscodeLineIndex = location.startLine - 1 + lineOffset;

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

                    axeErrorDetails.push({
                      line: vscodeLineIndex,
                      ruleId: violation.id,
                      message: fullMessage,
                      helpUrl: violation.helpUrl || '',
                    });
                  }
                }
              } catch (selectorError) {
                if (isVue) {
                  const fallbackElement =
                    dom!.window.document.querySelector('main');
                  if (fallbackElement) {
                    const location = dom!.nodeLocation(fallbackElement);
                    if (location) {
                      const vscodeLineIndex =
                        location.startLine - 1 + lineOffset;

                      axeErrorDetails.push({
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

      // ---------------------------------------------------------
      // merge (AST + AXE)
      // ---------------------------------------------------------
      const combinedDetails = [...axeErrorDetails, ...astVueErrors];

      const uniqueDetails = combinedDetails.filter(
        (err, index, self) =>
          index ===
          self.findIndex((t) => t.line === err.line && t.ruleId === err.ruleId),
      );

      const allErrorLines = Array.from(
        new Set(uniqueDetails.map((d) => d.line)),
      );
      const currentViolations = Array.from(
        new Set(uniqueDetails.map((d) => d.ruleId)),
      );

      let fixedFoodType: FoodType | undefined = undefined;
      if (currentViolations.length < previousViolations.length) {
        const resolvedRuleId = previousViolations.find(
          (id) => !currentViolations.includes(id),
        );

        if (resolvedRuleId) {
          fixedFoodType = getFoodTypeForRule(resolvedRuleId);
        }
      }

      const response: WorkerAnalysisResult & {
        isParsingError?: boolean;
        currentViolations: string[];
        errorLines?: number[];
        errorDetails?: A11yErrorDetail[];
      } = {
        fileName,
        errorCount: uniqueDetails.length,
        fixedFoodType,
        errorLines: allErrorLines,
        errorDetails: uniqueDetails,
        currentViolations,
        isParsingError: false,
      };

      if (process.send) {
        process.send(response);
      }
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

      if (process.send) {
        process.send(errorResponse);
      }
    } finally {
      if (dom) {
        dom.window.close();
        dom = null;
      }
    }
  },
);
