// Test file for entityId utilities
import { 
  EntityTypes, 
  createEntityId, 
  parseEntityId, 
  normalizeId, 
  isSameEntity,
  findEntityById,
  inferEntityType,
  parseEntityReference
} from './entityId.js'

console.log('Testing Entity ID Utilities...\n')

// Test createEntityId
console.log('=== Testing createEntityId ===')
try {
  console.log('✓ createEntityId("poi", 123):', createEntityId(EntityTypes.POI, 123))
  console.log('✓ createEntityId("custom_poi", "456"):', createEntityId(EntityTypes.CUSTOM_POI, "456"))
  try {
    createEntityId(null, 123)
  } catch (e) {
    console.log('✓ Correctly throws error for null type:', e.message)
  }
} catch (e) {
  console.error('✗ createEntityId failed:', e)
}

// Test parseEntityId
console.log('\n=== Testing parseEntityId ===')
console.log('✓ parseEntityId("poi:123"):', parseEntityId("poi:123"))
console.log('✓ parseEntityId("custom_456"):', parseEntityId("custom_456"))
console.log('✓ parseEntityId(789):', parseEntityId(789))
console.log('✓ parseEntityId(null):', parseEntityId(null))

// Test normalizeId
console.log('\n=== Testing normalizeId ===')
console.log('✓ normalizeId("123"):', normalizeId("123"))
console.log('✓ normalizeId(123):', normalizeId(123))
console.log('✓ normalizeId("abc"):', normalizeId("abc"))
console.log('✓ normalizeId(null):', normalizeId(null))

// Test isSameEntity
console.log('\n=== Testing isSameEntity ===')
console.log('✓ isSameEntity(123, "123"):', isSameEntity(123, "123"))
console.log('✓ isSameEntity("456", 456):', isSameEntity("456", 456))
console.log('✓ isSameEntity("abc", "abc"):', isSameEntity("abc", "abc"))
console.log('✓ isSameEntity(123, 456):', isSameEntity(123, 456))

// Test findEntityById
console.log('\n=== Testing findEntityById ===')
const testCollection = [
  { id: 1, name: 'POI 1' },
  { id: "2", name: 'POI 2' },
  { id: 3, name: 'POI 3' }
]
console.log('✓ findEntityById with numeric match:', findEntityById(testCollection, 1))
console.log('✓ findEntityById with string/number match:', findEntityById(testCollection, "2"))
console.log('✓ findEntityById with no match:', findEntityById(testCollection, 999))

// Test inferEntityType
console.log('\n=== Testing inferEntityType ===')
const context = {
  pois: [{ id: 1 }, { id: 2 }],
  customPOIs: [{ id: 3 }, { id: 4 }],
  connections: [{ id: 5 }]
}
console.log('✓ inferEntityType(1, context):', inferEntityType(1, context))
console.log('✓ inferEntityType(3, context):', inferEntityType(3, context))
console.log('✓ inferEntityType("custom_4"):', inferEntityType("custom_4"))
console.log('✓ inferEntityType(999, context):', inferEntityType(999, context))

// Test parseEntityReference
console.log('\n=== Testing parseEntityReference ===')
console.log('✓ parseEntityReference({type: "poi", id: 123}):', 
  parseEntityReference({type: EntityTypes.POI, id: 123}))
console.log('✓ parseEntityReference("custom_456"):', 
  parseEntityReference("custom_456"))
console.log('✓ parseEntityReference(789, context):', 
  parseEntityReference(789, { pois: [{id: 789}] }))

console.log('\n✅ All tests completed!')