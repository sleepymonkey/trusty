module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src/services/test', ],
  testMatch: ['**/*test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
    "moduleFileExtensions": [
      "ts",
      "tsx",
      "js",
    ]
    
};
