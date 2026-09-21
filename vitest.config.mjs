import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.js'],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      'pedigree': path.resolve(__dirname, 'src/script/'),
      'vendor': path.resolve(__dirname, 'public/vendor/'),
    },
  },
});
