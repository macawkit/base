import eslint from '@eslint/js';
import tslint from 'typescript-eslint';

export default tslint.config(
    eslint.configs.recommended,
    ...tslint.configs.strictTypeChecked,
    ...tslint.configs.stylisticTypeChecked,
    {
        languageOptions: {
            parserOptions: {
                project: 'tsconfig.all.json',
                tsconfigDirName: import.meta.dirname
            }
        }
    },
    {
        ignores: ['dist/']
    },
    {
        rules: {
            'quotes': ['error', 'single'],
            'space-before-function-paren': ['error', 'always'],
            'func-call-spacing': ['error', 'never'],
            'space-in-parens': ['error', 'never'],
            'comma-spacing': ['error', {
                before: false,
                after: true
            }],
            'arrow-spacing': ['error', {
                before: true,
                after: true
            }],
            'keyword-spacing': ['error', {
                before: true,
                after: true
            }],
            'comma-dangle': ['error', 'never'],
            'curly': ['error', 'multi'],
            'semi': ['error', 'always'],
            'object-curly-spacing': ['error', 'always'],
            'space-infix-ops': 'error',
            '@typescript-eslint/type-annotation-spacing': ['error', {
                before: false,
                after: true,
                overrides: {
                    arrow: {
                        before: true,
                        after: true
                    }
                }
            }],
            '@typescript-eslint/no-non-null-assertion': 'off'
        }
    }
);