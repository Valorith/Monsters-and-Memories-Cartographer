<template>
  <div v-if="visible" class="context-menu" :style="{ left: position.x + 'px', top: position.y + 'px' }" @click.stop>
    <button v-if="isAuthenticated" @click="createCustomPOI" class="context-menu-item">
      📍 Create Custom POI Here
    </button>
    <button v-if="customPoi && customPoi.is_owner" @click="editCustomPOI" class="context-menu-item">
      ✏️ Edit Custom POI
    </button>
    <button v-if="customPoi && customPoi.is_owner" @click="deleteCustomPOI" class="context-menu-item">
      🗑️ Delete Custom POI
    </button>
    <button v-if="!isAuthenticated" @click="promptLogin" class="context-menu-item">
      🔒 Sign in to create Custom POIs
    </button>
  </div>
</template>

<script>
export default {
  name: 'ContextMenu',
  props: {
    visible: Boolean,
    position: Object,
    isAuthenticated: Boolean,
    customPoi: Object
  },
  methods: {
    createCustomPOI() {
      this.$emit('create-custom-poi');
      this.$emit('close');
    },
    editCustomPOI() {
      this.$emit('edit-custom-poi', this.customPoi);
      this.$emit('close');
    },
    deleteCustomPOI() {
      this.$emit('delete-custom-poi', this.customPoi);
      this.$emit('close');
    },
    promptLogin() {
      window.location.href = '/auth/google';
    }
  }
}
</script>

<style scoped>
.context-menu {
  position: absolute;
  background: #2d2d2d;
  border: 1px solid #444;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  padding: 0.5rem 0;
  min-width: 200px;
}

.context-menu-item {
  display: block;
  width: 100%;
  padding: 0.5rem 1rem;
  background: none;
  border: none;
  color: #e0e0e0;
  text-align: left;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.context-menu-item:hover {
  background: #3a3a3a;
  color: white;
}
</style>