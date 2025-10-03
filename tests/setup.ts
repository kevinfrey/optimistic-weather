if (typeof globalThis.crypto === 'undefined') {
  const { webcrypto } = await import('node:crypto')
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  })
}

if (typeof globalThis.crypto.randomUUID !== 'function') {
  const { randomUUID } = await import('node:crypto')
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: randomUUID,
    configurable: true,
  })
}
