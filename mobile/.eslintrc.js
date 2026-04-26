module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // Keep mobile lint focused on code issues; formatting is a separate cleanup track.
    'prettier/prettier': 'off',
    semi: 'off',
    quotes: 'off',
    curly: 'off',
    'no-void': 'off',
    'no-extra-semi': 'off',
    'no-bitwise': 'off',
    'no-catch-shadow': 'off',
    '@typescript-eslint/func-call-spacing': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    'react/no-unstable-nested-components': ['warn', { allowAsProps: true }],
  },
};
