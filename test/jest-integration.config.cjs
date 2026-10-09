module.exports = {
    rootDir: '..',
    testEnvironment: 'node',
    testMatch: ['<rootDir>/test/integration/**/*.spec.cjs'],
    transform: {},
    maxWorkers: 1,
    testTimeout: 30000,
};
