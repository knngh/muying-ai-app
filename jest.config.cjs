module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  extensionsToTreatAsEsm: ['.ts'],
  testPathIgnorePatterns: ['/\\._'],
  transformIgnorePatterns: ['/node_modules/(?!uuid/)'],
  transform: {
    // Thrift loads ESM-only uuid through require; Jest 29 needs it transformed.
    '^.+\\.js$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'ES2022',
          module: 'CommonJS',
          allowJs: true,
          esModuleInterop: true,
          isolatedModules: true,
        },
      },
    ],
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          esModuleInterop: true,
          isolatedModules: true,
          types: ['jest', 'node'],
        },
      },
    ],
  },
};
