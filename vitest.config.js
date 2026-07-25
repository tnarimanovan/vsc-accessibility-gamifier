"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// vitest.config.ts
const { defineConfig } = require('vitest/config');
module.exports = defineConfig({
    test: {
        globals: true,
        environment: 'node',
        exclude: ['**/node_modules/**', '**/dist/**'],
    },
});
//# sourceMappingURL=vitest.config.js.map