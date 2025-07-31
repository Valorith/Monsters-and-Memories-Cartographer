<template>
  <div class="account-settings">
    <div class="settings-header">
      <h2>Account Settings</h2>
      <button @click="$emit('close')" class="close-btn">✕</button>
    </div>
    
    <div class="settings-content" v-if="user">
      <div class="profile-section">
        <img :src="user.picture" :alt="user.name" class="profile-picture" />
        <div class="profile-info">
          <h3>{{ user.name }}</h3>
          <p>{{ user.email }}</p>
          <span v-if="user.is_admin" class="admin-badge">Admin</span>
        </div>
      </div>

      <div class="settings-section">
        <h3>Preferences</h3>
        
        <div class="setting-item">
          <label>Theme</label>
          <select v-model="preferences.theme" @change="updatePreferences">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto</option>
          </select>
        </div>

        <div class="setting-item">
          <label>Language</label>
          <select v-model="preferences.language" @change="updatePreferences">
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="ja">Japanese</option>
          </select>
        </div>

        <div class="setting-item">
          <label>
            <input 
              type="checkbox" 
              v-model="preferences.notifications_enabled" 
              @change="updatePreferences"
            />
            Enable notifications
          </label>
        </div>
      </div>

      <div class="settings-section">
        <h3>Account Actions</h3>
        <button @click="logout" class="logout-btn">Sign Out</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AccountSettings',
  props: {
    user: Object
  },
  data() {
    return {
      preferences: {
        theme: 'light',
        notifications_enabled: true,
        language: 'en'
      }
    };
  },
  mounted() {
    this.loadPreferences();
  },
  methods: {
    async loadPreferences() {
      try {
        const response = await fetch('/api/user/preferences');
        if (response.ok) {
          const data = await response.json();
          if (data.theme) this.preferences = data;
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      }
    },
    
    async updatePreferences() {
      try {
        const response = await fetch('/api/user/preferences', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(this.preferences)
        });
        
        if (response.ok) {
          this.$emit('preferences-updated', this.preferences);
        }
      } catch (error) {
        console.error('Error updating preferences:', error);
      }
    },
    
    async logout() {
      try {
        const response = await fetch('/api/auth/logout', {
          method: 'POST'
        });
        
        if (response.ok) {
          window.location.href = '/';
        }
      } catch (error) {
        console.error('Error logging out:', error);
      }
    }
  }
};
</script>

<style scoped>
.account-settings {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  z-index: 1000;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e0e0e0;
}

.settings-header h2 {
  margin: 0;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0.25rem;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
}

.close-btn:hover {
  background: #f0f0f0;
}

.settings-content {
  padding: 1.5rem;
}

.profile-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid #e0e0e0;
}

.profile-picture {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  object-fit: cover;
}

.profile-info h3 {
  margin: 0 0 0.25rem 0;
  color: #333;
}

.profile-info p {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
}

.admin-badge {
  display: inline-block;
  background: #4CAF50;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  margin-top: 0.5rem;
}

.settings-section {
  margin-bottom: 2rem;
}

.settings-section h3 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1.1rem;
}

.setting-item {
  margin-bottom: 1rem;
}

.setting-item label {
  display: block;
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.setting-item select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  background: white;
}

.setting-item input[type="checkbox"] {
  margin-right: 0.5rem;
}

.logout-btn {
  background: #f44336;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.logout-btn:hover {
  background: #d32f2f;
}
</style>