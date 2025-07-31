// Entity ID utilities for type-safe ID handling

export const EntityTypes = {
  POI: 'poi',
  CUSTOM_POI: 'custom_poi',
  CONNECTION: 'connection',
  CONNECTOR: 'connector',
  ZONE_CONNECTOR: 'zone_connector',
  PENDING_POI: 'pending_poi',
  POI_TYPE: 'poi_type'
}

/**
 * Creates a type-safe entity ID string
 * @param {string} type - Entity type from EntityTypes
 * @param {number|string} id - Entity ID
 * @returns {string} - Formatted entity ID like "poi:123"
 */
export function createEntityId(type, id) {
  if (!type || !id) {
    throw new Error('Both type and id are required for createEntityId')
  }
  return `${type}:${id}`
}

/**
 * Parses an entity ID string into type and numeric ID
 * @param {string} entityId - Entity ID string like "poi:123" or legacy "custom_123"
 * @returns {object} - { type, id, numericId }
 */
export function parseEntityId(entityId) {
  if (!entityId) {
    return { type: null, id: null, numericId: null }
  }
  
  // Handle legacy custom_ prefix
  if (typeof entityId === 'string' && entityId.startsWith('custom_')) {
    const id = entityId.replace('custom_', '')
    return {
      type: EntityTypes.CUSTOM_POI,
      id: id,
      numericId: parseInt(id)
    }
  }
  
  // Handle new format "type:id"
  if (typeof entityId === 'string' && entityId.includes(':')) {
    const [type, ...idParts] = entityId.split(':')
    const id = idParts.join(':') // Handle IDs that might contain colons
    return {
      type,
      id,
      numericId: parseInt(id)
    }
  }
  
  // Handle plain numeric or string IDs (legacy)
  return {
    type: null, // Unknown type
    id: entityId,
    numericId: typeof entityId === 'string' && !isNaN(entityId) ? parseInt(entityId) : entityId
  }
}

/**
 * Normalizes an ID to ensure consistent type for comparison
 * @param {*} id - ID to normalize
 * @returns {number|string} - Normalized ID
 */
export function normalizeId(id) {
  if (id === null || id === undefined) return null
  
  // If it's a string that looks like a number, convert it
  if (typeof id === 'string' && !isNaN(id) && id.trim() !== '') {
    return parseInt(id)
  }
  
  return id
}

/**
 * Checks if two IDs refer to the same entity
 * @param {*} id1 - First ID
 * @param {*} id2 - Second ID
 * @returns {boolean} - True if IDs match
 */
export function isSameEntity(id1, id2) {
  return normalizeId(id1) === normalizeId(id2)
}

/**
 * Finds an entity by ID in a collection, handling type normalization
 * @param {Array} collection - Array of entities with 'id' property
 * @param {*} targetId - ID to search for
 * @returns {object|null} - Found entity or null
 */
export function findEntityById(collection, targetId) {
  if (!collection || !Array.isArray(collection)) return null
  
  const normalizedTarget = normalizeId(targetId)
  return collection.find(item => normalizeId(item.id) === normalizedTarget)
}

/**
 * Infers entity type from context (used for legacy support)
 * @param {*} id - Entity ID
 * @param {object} context - Context object with data arrays
 * @returns {string|null} - Inferred entity type
 */
export function inferEntityType(id, context = {}) {
  const normalizedId = normalizeId(id)
  
  // Check if it's a custom POI by prefix
  if (typeof id === 'string' && id.startsWith('custom_')) {
    return EntityTypes.CUSTOM_POI
  }
  
  // Check in context data
  if (context.customPOIs && findEntityById(context.customPOIs, normalizedId)) {
    return EntityTypes.CUSTOM_POI
  }
  
  if (context.pois && findEntityById(context.pois, normalizedId)) {
    return EntityTypes.POI
  }
  
  if (context.connections && findEntityById(context.connections, normalizedId)) {
    return EntityTypes.CONNECTION
  }
  
  if (context.connectors && findEntityById(context.connectors, normalizedId)) {
    return EntityTypes.CONNECTOR
  }
  
  return null
}

/**
 * Creates a backward-compatible entity reference
 * @param {string|object} entityIdOrObject - Legacy ID or new {type, id} object
 * @returns {object} - {type, id, numericId}
 */
export function parseEntityReference(entityIdOrObject, context = {}) {
  if (!entityIdOrObject) {
    return { type: null, id: null, numericId: null }
  }
  
  // New format: {type, id}
  if (typeof entityIdOrObject === 'object' && entityIdOrObject.type && entityIdOrObject.id) {
    return {
      type: entityIdOrObject.type,
      id: entityIdOrObject.id,
      numericId: normalizeId(entityIdOrObject.id)
    }
  }
  
  // Legacy format: just an ID
  const parsed = parseEntityId(entityIdOrObject)
  
  // Try to infer type if not available
  if (!parsed.type && context) {
    parsed.type = inferEntityType(entityIdOrObject, context)
  }
  
  return parsed
}

/**
 * Validates that an entity operation is safe
 * @param {string} operation - Operation type (create, update, delete)
 * @param {object} entity - Entity being operated on
 * @param {object} context - Context with existing entities
 * @returns {object} - { valid: boolean, error: string }
 */
export function validateEntityOperation(operation, entity, context = {}) {
  if (!entity) {
    return { valid: false, error: 'Entity is required' }
  }
  
  const entityRef = parseEntityReference(entity.id || entity, context)
  
  switch (operation) {
    case 'create':
      // Check for ID collisions
      if (entityRef.id && entityRef.type) {
        const existing = findEntityInContext(entityRef, context)
        if (existing) {
          return { 
            valid: false, 
            error: `${entityRef.type} with ID ${entityRef.id} already exists` 
          }
        }
      }
      break
      
    case 'update':
    case 'delete':
      // Verify entity exists
      if (!entityRef.type) {
        return { 
          valid: false, 
          error: 'Entity type could not be determined' 
        }
      }
      
      const found = findEntityInContext(entityRef, context)
      if (!found) {
        return { 
          valid: false, 
          error: `${entityRef.type} with ID ${entityRef.id} not found` 
        }
      }
      break
      
    default:
      return { valid: false, error: `Unknown operation: ${operation}` }
  }
  
  return { valid: true }
}

/**
 * Helper to find entity in context by type and ID
 * @param {object} entityRef - Parsed entity reference
 * @param {object} context - Context with entity arrays
 * @returns {object|null} - Found entity or null
 */
function findEntityInContext(entityRef, context) {
  if (!entityRef.type || !entityRef.id) return null
  
  const typeToContextMap = {
    [EntityTypes.POI]: 'pois',
    [EntityTypes.CUSTOM_POI]: 'customPOIs',
    [EntityTypes.CONNECTION]: 'connections',
    [EntityTypes.CONNECTOR]: 'connectors',
    [EntityTypes.ZONE_CONNECTOR]: 'zoneConnectors',
    [EntityTypes.PENDING_POI]: 'pendingPOIs'
  }
  
  const contextKey = typeToContextMap[entityRef.type]
  if (!contextKey || !context[contextKey]) return null
  
  return findEntityById(context[contextKey], entityRef.numericId || entityRef.id)
}

/**
 * Checks if an entity can connect to another entity
 * @param {object} fromEntity - Source entity
 * @param {object} toEntity - Target entity
 * @returns {object} - { canConnect: boolean, reason: string }
 */
export function canConnectEntities(fromEntity, toEntity) {
  if (!fromEntity || !toEntity) {
    return { canConnect: false, reason: 'Both entities are required' }
  }
  
  // Parse entity references
  const fromRef = parseEntityReference(fromEntity)
  const toRef = parseEntityReference(toEntity)
  
  // Prevent connections to custom POIs
  if (toRef.type === EntityTypes.CUSTOM_POI || 
      (typeof toEntity.id === 'string' && toEntity.id.startsWith('custom_')) ||
      toEntity.is_custom) {
    return { 
      canConnect: false, 
      reason: 'Connections to custom POIs are not supported' 
    }
  }
  
  // Prevent self-connections
  if (fromRef.type === toRef.type && isSameEntity(fromRef.id, toRef.id)) {
    return { 
      canConnect: false, 
      reason: 'Cannot connect an entity to itself' 
    }
  }
  
  return { canConnect: true }
}