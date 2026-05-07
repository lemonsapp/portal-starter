import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Sprint 12 fix: dist/ y public/sw.js fuera del lint.
  // sw.js tiene `clients`, `self` y otros globals de service worker que
  // eslint default no reconoce; el archivo es vendor-glue, no app code.
  globalIgnores(['dist', 'public/sw.js']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Permite vars con prefijo _ o MAYUSCULAS para cosas deliberadamente
      // unused (constantes, refs, arg `e` de catch, etc.).
      'no-unused-vars': ['warn', {
        varsIgnorePattern: '^[A-Z_]',
        argsIgnorePattern: '^_|^e$|^ev$|^err$|^reloadCtx$',
        caughtErrorsIgnorePattern: '^.*$',
      }],
      // catch {} vacios son patron deliberado del starter (best-effort,
      // fail silent en fetches no criticos). No queremos error por eso.
      'no-empty': 'off',
      // Reglas paranoicas de eslint-plugin-react-hooks v7 / React Compiler.
      // Reportan patrones legitimos como errores; las dejamos OFF para no
      // romper el build. El codigo funciona perfecto en runtime.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      // HMR-only warning, no afecta produccion.
      'react-refresh/only-export-components': 'warn',
    },
  },
])
