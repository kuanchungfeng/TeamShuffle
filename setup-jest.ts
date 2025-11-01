import 'jest-preset-angular/setup-jest';

if (typeof globalThis.structuredClone !== 'function') {
  Object.defineProperty(globalThis, 'structuredClone', {
    configurable: true,
    writable: true,
    value: <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
  });
}
