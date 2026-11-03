import tseslint from '@electron-toolkit/eslint-config-ts'
import prettierConfig from '@electron-toolkit/eslint-config-prettier'

export default [
  { ignores: ['**/node_modules/**', '**/out/**', '**/dist/**'] },
  ...tseslint,
  prettierConfig
]
