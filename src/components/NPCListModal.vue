<template>
  <div v-if="visible" class="modal-overlay" @click="$emit('close')">
    <div class="modal-container" @click.stop>
      <div class="modal-header">
        <h2 class="modal-title">NPC Information</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      
      <div v-if="npc" class="modal-content">
        <!-- NPC Header -->
        <div class="npc-header">
          <div class="npc-icon-large">💀</div>
          <div class="npc-title-section">
            <h3 class="npc-name">{{ npc.name }}</h3>
            <div class="npc-type-level">
              <span class="npc-type">{{ npc.npc_type || 'Monster' }}</span>
              <span class="stat-divider">•</span>
              <span class="npc-level">Level {{ npc.level }}</span>
            </div>
          </div>
        </div>
        
        <!-- Primary Stats -->
        <div class="npc-primary-stats">
          <div class="stat-group">
            <span class="stat-label">HP</span>
            <span class="stat-value">{{ npc.hp }}</span>
          </div>
          <div class="stat-group">
            <span class="stat-label">MP</span>
            <span class="stat-value">{{ npc.mp }}</span>
          </div>
          <div class="stat-group">
            <span class="stat-label">AC</span>
            <span class="stat-value">{{ npc.ac }}</span>
          </div>
          <div class="stat-group">
            <span class="stat-label">Damage</span>
            <span class="stat-value">{{ npc.min_dmg }}-{{ npc.max_dmg }}</span>
          </div>
          <div class="stat-group">
            <span class="stat-label">Attack Speed</span>
            <span class="stat-value">{{ npc.attack_speed || 0 }}</span>
          </div>
        </div>
        
        <!-- Attributes -->
        <div v-if="hasAttributes" class="npc-attributes">
          <h4>Attributes</h4>
          <div class="attributes-grid">
            <div v-if="npc.str" class="attribute">
              <span class="attr-label">STR</span>
              <span class="attr-value">{{ npc.str }}</span>
            </div>
            <div v-if="npc.sta" class="attribute">
              <span class="attr-label">STA</span>
              <span class="attr-value">{{ npc.sta }}</span>
            </div>
            <div v-if="npc.agi" class="attribute">
              <span class="attr-label">AGI</span>
              <span class="attr-value">{{ npc.agi }}</span>
            </div>
            <div v-if="npc.dex" class="attribute">
              <span class="attr-label">DEX</span>
              <span class="attr-value">{{ npc.dex }}</span>
            </div>
            <div v-if="npc.wis" class="attribute">
              <span class="attr-label">WIS</span>
              <span class="attr-value">{{ npc.wis }}</span>
            </div>
            <div v-if="npc.int" class="attribute">
              <span class="attr-label">INT</span>
              <span class="attr-value">{{ npc.int }}</span>
            </div>
            <div v-if="npc.cha" class="attribute">
              <span class="attr-label">CHA</span>
              <span class="attr-value">{{ npc.cha }}</span>
            </div>
          </div>
        </div>

        <!-- NPC Description -->
        <div v-if="npc.description" class="npc-description">
          <p>{{ npc.description }}</p>
        </div>

        <!-- POI Locations -->
        <div class="locations-section">
          <h4>Found at {{ pois.length }} location{{ pois.length === 1 ? '' : 's' }}</h4>
          <div v-if="loadingPOIs" class="loading">
            <span class="spinner">⟳</span> Loading locations...
          </div>
          <div v-else-if="pois.length === 0" class="no-pois">
            No locations found for this NPC.
          </div>
          <div v-else class="pois-list">
            <!-- Group POIs by map -->
            <div v-for="mapGroup in groupedPOIs" :key="mapGroup.mapId" class="map-group">
              <h5 class="map-group-title">{{ mapGroup.mapName }}</h5>
              <div 
                v-for="poi in mapGroup.pois" 
                :key="poi.id"
                class="poi-item"
                @click="selectPOI(poi)"
                @mouseenter="hoveredPOI = poi.id"
                @mouseleave="hoveredPOI = null"
              >
                <div class="poi-icon">
                  <span v-if="getPoiIcon(poi).type === 'emoji'">{{ getPoiIcon(poi).value }}</span>
                  <iconify-icon v-else-if="getPoiIcon(poi).type === 'iconify'" :icon="getPoiIcon(poi).value" width="24" height="24"></iconify-icon>
                </div>
                <div class="poi-info">
                  <div class="poi-name">{{ poi.name }}</div>
                  <div class="poi-type">{{ poi.type_name || 'POI' }}</div>
                </div>
                <div class="poi-coords">
                  ({{ poi.x }}, {{ poi.y }})
                </div>
                <div class="arrow-icon">→</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch, computed } from 'vue';

export default {
  name: 'NPCListModal',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    npc: {
      type: Object,
      default: null
    }
  },
  emits: ['close', 'select-poi'],
  setup(props, { emit }) {
    const pois = ref([]);
    const loadingPOIs = ref(false);
    const hoveredPOI = ref(null);

    const groupedPOIs = computed(() => {
      const groups = {};
      pois.value.forEach(poi => {
        const mapName = poi.map_name || 'Unknown Map';
        if (!groups[poi.map_id]) {
          groups[poi.map_id] = {
            mapId: poi.map_id,
            mapName: mapName,
            pois: []
          };
        }
        groups[poi.map_id].pois.push(poi);
      });
      return Object.values(groups).sort((a, b) => a.mapName.localeCompare(b.mapName));
    });
    
    const hasAttributes = computed(() => {
      if (!props.npc) return false;
      return props.npc.str || props.npc.sta || props.npc.agi || 
             props.npc.dex || props.npc.wis || props.npc.int || 
             props.npc.cha;
    });

    const getPoiIcon = (poi) => {
      if (poi.type_icon_type === 'emoji' && poi.type_icon_value) {
        return { type: 'emoji', value: poi.type_icon_value };
      } else if (poi.type_icon_type === 'iconify' && poi.type_icon_value) {
        return { type: 'iconify', value: poi.type_icon_value };
      }
      return { type: 'emoji', value: '📍' };
    };

    const loadPOIs = async () => {
      if (!props.npc || !props.npc.npcid) return;
      
      loadingPOIs.value = true;
      pois.value = [];
      
      try {
        const response = await fetch(`/api/npcs/${props.npc.npcid}/pois`);
        if (response.ok) {
          pois.value = await response.json();
        }
      } catch (error) {
        console.error('Error loading POIs:', error);
      } finally {
        loadingPOIs.value = false;
      }
    };

    const selectPOI = (poi) => {
      emit('select-poi', poi);
      emit('close');
    };

    // Load POIs when NPC changes
    watch(() => props.npc, (newNPC) => {
      if (newNPC && props.visible) {
        loadPOIs();
      }
    });

    // Load POIs when modal becomes visible
    watch(() => props.visible, (newVisible) => {
      if (newVisible && props.npc) {
        loadPOIs();
      }
    });

    return {
      pois,
      loadingPOIs,
      hoveredPOI,
      groupedPOIs,
      hasAttributes,
      getPoiIcon,
      selectPOI
    };
  }
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-container {
  background: #2d2d2d;
  border: 2px solid #4a7c59;
  border-radius: 8px;
  max-width: 700px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #444;
}

.modal-title {
  color: #FFD700;
  font-size: 1.5rem;
  margin: 0;
  font-family: 'Cinzel', serif;
}

.close-btn {
  background: none;
  border: none;
  color: #FFD700;
  font-size: 2rem;
  cursor: pointer;
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 215, 0, 0.2);
  transform: rotate(90deg);
}

.modal-content {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

/* NPC Header */
.npc-header {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1.5rem;
}

.npc-icon-large {
  font-size: 3rem;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 215, 0, 0.1);
  border: 2px solid #FFD700;
  border-radius: 8px;
}

.npc-title-section {
  flex: 1;
}

.npc-name {
  color: #FFD700;
  font-size: 1.5rem;
  margin: 0 0 0.25rem 0;
}

.npc-type-level {
  color: #999;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.npc-type {
  color: #b8956a;
  font-style: italic;
}

.npc-level {
  color: #FFA500;
  font-weight: bold;
}

/* Primary Stats */
.npc-primary-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid #444;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.stat-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.stat-label {
  color: #999;
  font-size: 0.8rem;
  font-weight: bold;
  margin-bottom: 0.25rem;
}

.stat-value {
  color: #FFD700;
  font-size: 1.1rem;
  font-weight: bold;
}

/* Attributes */
.npc-attributes {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid #333;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.npc-attributes h4 {
  color: #FFD700;
  margin: 0 0 1rem 0;
  font-size: 1rem;
}

.attributes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  gap: 0.75rem;
}

.attribute {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 215, 0, 0.05);
  border: 1px solid rgba(255, 215, 0, 0.2);
  border-radius: 4px;
  padding: 0.5rem;
}

.attr-label {
  color: #999;
  font-size: 0.75rem;
  font-weight: bold;
}

.attr-value {
  color: #4dff4d;
  font-weight: bold;
}

.stat-divider {
  color: #666;
}

/* NPC Description */
.npc-description {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid #444;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.npc-description p {
  color: #e0e0e0;
  margin: 0;
  line-height: 1.5;
}

/* Locations Section */
.locations-section h4 {
  color: #FFD700;
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
}

.loading {
  text-align: center;
  color: #FFD700;
  padding: 2rem;
}

.spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.no-pois {
  text-align: center;
  color: #999;
  padding: 2rem;
  font-style: italic;
}

.pois-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.map-group {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid #333;
  border-radius: 4px;
  padding: 1rem;
}

.map-group-title {
  color: #FFA500;
  font-size: 1rem;
  margin: 0 0 0.75rem 0;
  font-weight: bold;
}

.poi-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 0.5rem;
}

.poi-item:last-child {
  margin-bottom: 0;
}

.poi-item:hover {
  background: rgba(255, 215, 0, 0.1);
  border-color: rgba(255, 215, 0, 0.3);
  transform: translateX(4px);
}

.poi-icon {
  font-size: 1.5rem;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.poi-info {
  flex: 1;
}

.poi-name {
  color: #FFD700;
  font-weight: bold;
  margin-bottom: 0.2rem;
}

.poi-type {
  color: #999;
  font-size: 0.85rem;
}

.poi-coords {
  color: #666;
  font-size: 0.85rem;
  font-family: monospace;
}

.arrow-icon {
  color: #FFD700;
  font-size: 1.25rem;
}

/* Scrollbar styling */
.modal-content::-webkit-scrollbar {
  width: 8px;
}

.modal-content::-webkit-scrollbar-track {
  background: #1a1a1a;
  border-radius: 4px;
}

.modal-content::-webkit-scrollbar-thumb {
  background: #4a7c59;
  border-radius: 4px;
}

.modal-content::-webkit-scrollbar-thumb:hover {
  background: #5fa772;
}
</style>