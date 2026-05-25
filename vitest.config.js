import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.js'],
    setupFiles: ['tests/unit/setup.js'],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      'pedigree': path.resolve(__dirname, 'src/script/'),
      'vendor': path.resolve(__dirname, 'public/vendor/'),
    },
  },
});
