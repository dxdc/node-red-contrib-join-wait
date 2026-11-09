// ESM because eslint-plugin-mocha 12 ships as ESM only (no require() export).
import js from '@eslint/js';
import mocha from 'eslint-plugin-mocha';
import globals from 'globals';

export default [
    {
        ignores: ['coverage/**', 'node_modules/**', '.nyc_output/**'],
    },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
                ...globals.es2022,
            },
        },
        rules: {
            indent: ['error', 4, { SwitchCase: 1 }],
            'linebreak-style': ['error', 'unix'],
            quotes: ['error', 'single', { avoidEscape: true }],
            semi: ['error', 'always'],
            'no-console': 'off',
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
        },
    },
    {
        files: ['**/*.mjs'],
        languageOptions: { sourceType: 'module' },
    },
    {
        files: ['test/**/*.js'],
        ...mocha.configs.recommended,
        rules: {
            ...mocha.configs.recommended.rules,
            'mocha/no-mocha-arrows': 'off',
        },
    },
];
