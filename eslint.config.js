
import js from '@eslint/js';
import globals from 'globals';
import security from 'eslint-plugin-security';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
    {
        ignores: ['node_modules', 'frontend/dist', 'coverage']
    },
    js.configs.recommended,
    security.configs.recommended,
    {
        files: ['frontend/src/**/*.js'],
        plugins: { 'react-hooks': reactHooks },
        rules: {
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn'
        }
    },
    {
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.browser
            }
        }
    }
];
