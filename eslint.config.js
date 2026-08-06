import js from '@eslint/js'
import eslintPluginVue from 'eslint-plugin-vue'
import ts from 'typescript-eslint'
import globals from 'globals'

export default ts.config(
  { ignores: ['dist/**', '**/target/**', 'src-tauri/gen/**', 'node_modules/**', '.claude/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...eslintPluginVue.configs['flat/recommended'],
  {
    files: ['src/**'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: ts.parser },
    },
  },
  {
    files: ['src/vite-env.d.ts'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
