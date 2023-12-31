module.exports = {
    verbose: true,
    moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],
    rootDir: '.',
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
    transformIgnorePatterns: ['node_modules/(?!(@gravity-ui)/)'],
    coverageDirectory: './coverage',
    collectCoverageFrom: ['src/**/*.{ts,tsx}', '!**/__stories__/**/*', '!**/*/*.stories.{ts,tsx}'],
    haste: {
        // Принудительно указываем использовать NodeJS API внутри jest-haste-map,
        // что значительно ускоряет чтение с файловой системы внутри arc.
        forceNodeFilesystemAPI: true,
    },
    watchman: false,
    testEnvironment: 'jsdom',
    testEnvironmentOptions: {},
};
