
import js from '@eslint/js';
import globals from 'globals';
import security from 'eslint-plugin-security';

export default [
    {
        ignores: ['node_modules', 'frontend/dist', 'coverage']
    },
    js.configs.recommended,
    security.configs.recommended,
    {
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.browser
            }
        }
    }
];
