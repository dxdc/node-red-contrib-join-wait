'use strict';

const js = require('@eslint/js');
const mocha = require('eslint-plugin-mocha');
const globals = require('globals');

module.exports = [
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
        files: ['test/**/*.js'],
        plugins: { mocha },
        languageOptions: {
            globals: {
                ...globals.mocha,
            },
        },
        rules: {
            ...mocha.configs.recommended.rules,
            'mocha/no-mocha-arrows': 'off',
            'mocha/no-setup-in-describe': 'off',
        },
    },
];
