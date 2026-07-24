import js from '@eslint/js'
import eslintPluginVue from 'eslint-plugin-vue'
import ts from 'typescript-eslint'

export default ts.config(
  { ignores: ['dist/**', '**/target/**', 'src-tauri/gen/**', 'node_modules/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...eslintPluginVue.configs['flat/recommended'],
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
