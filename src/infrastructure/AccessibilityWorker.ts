import { parentPort } from 'worker_threads';
import { JSDOM, VirtualConsole } from 'jsdom';
import { MoleFood } from '../shared/types';

// @ts-ignore
import axeCode from './axe.min.js';

const port = parentPort;
if (!port) {
  throw new Error('AccessibilityWorker must be initiated as a Worker Thread');
}

port.on(
  'message',
  async (message: { sourceCode: string; fileName: string }) => {
    const { sourceCode, fileName } = message;
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
      });

      dom.window.eval(axeCode);

      const results = await dom.window.axe.run(dom.window.document, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa'],
        },
        preload: false,
      });

      const errorCount = results.violations.length;
      const warningCount = results.incomplete.length;

      // Sending the result back to the main stream
      port.postMessage({
        isEdible: errorCount === 0,
        nutritionalValue: errorCount === 0 ? 15 : 0, // 15 XP for the perfect code!
        errorCount,
        warningCount,
        fileName,
        timestamp: Date.now(),
      } as MoleFood);
    } catch (error) {
      port.postMessage({
        isEdible: false,
        nutritionalValue: 0,
        errorCount: 1,
        warningCount: 0,
        fileName,
        timestamp: Date.now(),
        errorDetails: String(error),
      } as MoleFood);
    } finally {
      // clear the memory and destroy the virtual browser
      if (dom) {
        dom.window.close();
        dom = null;
      }
    }
  },
);
