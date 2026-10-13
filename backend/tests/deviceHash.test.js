const createDeviceHash = require("../src/utils/deviceHash");

const assert = require("assert");

// Test 1: Same identifier produces the same hash
const hash1 = createDeviceHash("test-device-123");
const hash2 = createDeviceHash("test-device-123");

assert.strictEqual(hash1, hash2);

// Test 2: Different identifiers produce different hashes
const hash3 = createDeviceHash("another-device-456");

assert.notStrictEqual(hash1, hash3);

// Test 3: Missing identifier returns null
assert.strictEqual(createDeviceHash(undefined), null);
assert.strictEqual(createDeviceHash(""), null);

console.log("All device hash tests passed!");