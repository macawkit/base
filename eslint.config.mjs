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
                tsconfigRootDir: import.meta.dirname
            }
        }
    },
    {
        ignores: ['dist/', 'dist-test/', 'eslint.config.mjs']
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
            '@typescript-eslint/no-non-null-assertion': 'off'
        }
    },
    {
        files: ['test/**/*.ts'],
        rules: {
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-unsafe-return': 'off'
        }
    }
);
