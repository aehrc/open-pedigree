const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        // PrototypeJS globals
        Class: 'readonly',
        $: 'readonly',
        $$: 'readonly',
        $F: 'readonly',
        Element: 'readonly',
        Event: 'readonly',
        Ajax: 'readonly',
        Prototype: 'readonly',
        Effect: 'readonly',
        Draggable: 'readonly',
        Droppables: 'readonly',
        // Project globals
        editor: 'writable',
        PhenoTips: 'readonly',
        Raphael: 'readonly',
        XWiki: 'readonly',
        OpenPedigree: 'writable',
      },
    },
    rules: {
      'brace-style': ['warn', '1tbs'],
      'curly': ['warn'],
      'indent': ['warn', 2],
      'linebreak-style': ['warn', 'unix'],
      'quotes': ['warn', 'single'],
      'semi': ['warn', 'always'],
      'no-console': 'off',
      'no-redeclare': 'warn',
      'no-unused-vars': ['warn', { 'args': 'none' }],
    },
  },
];
