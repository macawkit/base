import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import stylistic from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';

export default defineConfig(
    globalIgnores(['dist/']),
    eslint.configs.recommended,
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    {
        languageOptions: {
            parserOptions: {
                projectService: {
                    allowDefaultProject: ['*.mjs'],
                    defaultProject: 'tsconfig.tools.json'
                },
                tsconfigRootDir: import.meta.dirname
            }
        },
        plugins: {
            '@stylistic': stylistic
        },
        rules: {
            '@stylistic/quotes': ['error', 'single'],
            '@stylistic/space-before-function-paren': ['error', 'always'],
            '@stylistic/function-call-spacing': ['error', 'never'],
            '@stylistic/space-in-parens': ['error', 'never'],
            '@stylistic/comma-spacing': ['error', {
                before: false,
                after: true
            }],
            '@stylistic/arrow-spacing': ['error', {
                before: true,
                after: true
            }],
            '@stylistic/keyword-spacing': ['error', {
                before: true,
                after: true
            }],
            '@stylistic/comma-dangle': ['error', 'never'],
            'curly': ['error', 'multi', 'consistent'],
            '@stylistic/semi': ['error', 'always'],
            '@stylistic/object-curly-spacing': ['error', 'always'],
            '@stylistic/space-infix-ops': 'error',
            '@stylistic/type-annotation-spacing': ['error', {
                before: false,
                after: true,
                overrides: {
                    arrow: 'ignore'
                }
            }],
            '@typescript-eslint/explicit-member-accessibility': ['error', {
                accessibility: 'explicit',
                overrides: {
                    constructors: 'no-public'
                }
            }],
            '@typescript-eslint/no-non-null-assertion': 'off'
        }
    }
);
