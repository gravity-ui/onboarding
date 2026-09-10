import {defineConfig} from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/*.test.{ts,tsx}'],
        globals: true,
        environment: 'jsdom',
        environmentOptions: {jsdom: {url: 'http://localhost/'}},
        clearMocks: false,
        sequence: {hooks: 'list'},
        typecheck: {
            tsconfig: './tsconfig.test.json',
            include: ['src/**/*.test.{ts,tsx}'],
        },
        coverage: {
            provider: 'v8',
            include: ['src/**/*.{ts,tsx}'],
            exclude: [
                '**/*.test.{ts,tsx}',
                '**/tests/**',
                '**/__tests__/**',
                '**/__stories__/**',
                '**/*.stories.{ts,tsx}',
            ],
            reporter: ['text', 'json', 'lcov', 'clover'],
        },
    },
});
