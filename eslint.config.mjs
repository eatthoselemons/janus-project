import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier';

export default tseslint.config(
  {
    ignores: ['examples/**', 'dist/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Add Node.js globals
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        console: 'readonly',
      },
    },
    plugins: {
      prettier,
    },
    rules: {
      'prettier/prettier': 'error',
      'no-console': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' },
      ],
      // Disable no-undef as it's handled by TypeScript ESLint and custom globals
      'no-undef': 'off',
      // Disable no-useless-escape as it's often triggered by Prettier formatting
      'no-useless-escape': 'off',
      // Disable @typescript-eslint/no-require-imports as we are allowing require for now
      '@typescript-eslint/no-require-imports': 'off',
      // Disable require-yield as it's not always necessary for generator functions
      'require-yield': 'off',
    },
  },
);
