<template>
  <div class="account-page">
    <header class="account-header">
      <div class="header-content">
        <router-link to="/" class="back-link">
          ← Back to Maps
        </router-link>
        <h1 style="color: red;">Account Settings - TESTING 456</h1>
      </div>
    </header>

    <div class="account-container" v-if="user">
      <div class="account-sidebar">
        <p>DEBUG: Number of tabs = {{ tabs.length }}</p>
        <p>DEBUG: Tabs = {{ JSON.stringify(tabs) }}</p>
        <nav class="account-nav">
          <button 
            v-for="tab in tabs" 
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="['nav-item', { active: activeTab === tab.id }]"
          >
            <span class="nav-icon">{{ tab.icon }}</span>
            {{ tab.label }}
          </button>
        </nav>
      </div>

      <div class="account-content">
        <p>DEBUG: Current activeTab = {{ activeTab }}, user = {{ user }}, isAdmin = {{ user?.is_admin }}</p>
        
        <!-- Profile Tab -->
        <div v-if="activeTab === 'profile'" class="tab-content">
          <h2>Profile Information</h2>
          
          <div class="profile-card">
            <div class="profile-header">
              <img :src="user.picture" :alt="user.name" class="profile-avatar" />
              <div class="profile-details">
                <h3>{{ user.name }}</h3>
                <p>{{ user.email }}</p>
                <span v-if="user.is_admin" class="admin-badge">Administrator</span>
              </div>
            </div>
            
            <div class="profile-stats">
              <div class="stat-item">
                <span class="stat-label">Member Since</span>
                <span class="stat-value">{{ formatDate(user.created_at) }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Last Login</span>
                <span class="stat-value">{{ formatDate(user.last_login) }}</span>
              </div>
            </div>
          </div>

          <div class="google-info">
            <h3>Google Account</h3>
            <p>Your account is linked to your Google profile. Profile information is managed through Google.</p>
            <a href="https://myaccount.google.com" target="_blank" class="external-link">
              Manage Google Account →
            </a>
          </div>
        </div>

        <!-- Preferences Tab -->
        <div v-if="activeTab === 'preferences'" class="tab-content">
          <h2>Preferences</h2>
          
          <div class="preference-section">
            <h3>Appearance</h3>
            <div class="preference-item">
              <label for="theme">Theme</label>
              <select id="theme" v-model="preferences.theme" @change="updatePreferences">
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">Auto (System)</option>
              </select>
            </div>
          </div>

          <div class="preference-section">
            <h3>Language & Region</h3>
            <div class="preference-item">
              <label for="language">Language</label>
              <select id="language" v-model="preferences.language" @change="updatePreferences">
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="ja">日本語</option>
              </select>
            </div>
          </div>

          <div class="preference-section">
            <h3>Notifications</h3>
            <div class="preference-item checkbox-item">
              <label>
                <input 
                  type="checkbox" 
                  v-model="preferences.notifications_enabled" 
                  @change="updatePreferences"
                />
                <span>Enable email notifications</span>
              </label>
              <p class="preference-description">
                Receive updates about new features and important changes
              </p>
            </div>
          </div>
        </div>

        <!-- Privacy Tab -->
        <div v-if="activeTab === 'privacy'" class="tab-content">
          <h2>Privacy & Security</h2>
          
          <div class="privacy-section">
            <h3>Data & Privacy</h3>
            <p>Your data is stored securely and is never shared with third parties.</p>
            
            <div class="privacy-actions">
              <button @click="downloadData" class="secondary-btn">
                Download My Data
              </button>
              <button @click="showDeleteConfirm = true" class="danger-btn">
                Delete Account
              </button>
            </div>
          </div>

          <div class="privacy-section">
            <h3>Active Sessions</h3>
            <p>Manage your active login sessions across devices.</p>
            <button @click="logoutAllDevices" class="secondary-btn">
              Log Out All Devices
            </button>
          </div>
        </div>

        <!-- Admin Tab (only for admins) -->
        <div v-if="activeTab === 'admin' && user.is_admin" class="tab-content">
          <h2>Admin Settings</h2>
          <p>Debug: activeTab={{ activeTab }}, user.is_admin={{ user.is_admin }}</p>
          
          <div class="admin-section">
            <h3>User Management</h3>
            <p>Total registered users: {{ totalUsers }}</p>
            
            <div class="user-list">
              <h4>Recent Users</h4>
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Joined</th>
                    <th>Admin</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="u in recentUsers" :key="u.id">
                    <td>{{ u.name }}</td>
                    <td>{{ u.email }}</td>
                    <td>{{ formatDate(u.created_at) }}</td>
                    <td>
                      <span v-if="u.is_admin" class="status-badge admin">Yes</span>
                      <span v-else class="status-badge">No</span>
                    </td>
                    <td>
                      <button 
                        v-if="u.id !== user.id"
                        @click="toggleAdmin(u)" 
                        class="small-btn"
                      >
                        {{ u.is_admin ? 'Remove Admin' : 'Make Admin' }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <!-- POI Type Management -->
          <div style="border: 2px solid red; padding: 20px; margin: 20px 0;">
            <p>POITypeManager should appear below:</p>
            <POITypeManager />
          </div>
          
          <!-- Test Component -->
          <TestComponent />
        </div>
      </div>
    </div>

    <!-- Delete Account Confirmation -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click="showDeleteConfirm = false">
      <div class="modal-content" @click.stop>
        <h3>Delete Account</h3>
        <p>Are you sure you want to delete your account? This action cannot be undone.</p>
        <div class="modal-actions">
          <button @click="showDeleteConfirm = false" class="secondary-btn">Cancel</button>
          <button @click="deleteAccount" class="danger-btn">Delete Account</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import { useToast } from '../composables/useToast';
import POITypeManager from '../components/POITypeManager.vue';
import TestComponent from '../components/TestComponent.vue';

export default {
  name: 'AccountPage',
  components: {
    POITypeManager,
    TestComponent
  },
  setup() {
    const router = useRouter();
    const { user, isAuthenticated, logout } = useAuth();
    const { success, error } = useToast();
    
    const activeTab = ref('profile');
    const showDeleteConfirm = ref(false);
    const totalUsers = ref(0);
    const recentUsers = ref([]);
    
    const preferences = ref({
      theme: 'light',
      notifications_enabled: true,
      language: 'en'
    });

    const tabs = computed(() => {
      const baseTabs = [
        { id: 'profile', label: 'Profile', icon: '👤' },
        { id: 'custom-pois', label: 'Custom POIs', icon: '📍' },
        { id: 'preferences', label: 'Preferences', icon: '⚙️' },
        { id: 'privacy', label: 'Privacy & Security', icon: '🔒' }
      ];
      
      if (user.value?.is_admin) {
        baseTabs.push({ id: 'admin', label: 'Admin', icon: '👑' });
      }
      
      return baseTabs;
    });

    const formatDate = (dateString) => {
      if (!dateString) return 'Never';
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const loadPreferences = async () => {
      try {
        const response = await fetch('/api/user/preferences');
        if (response.ok) {
          const data = await response.json();
          if (data.theme) preferences.value = data;
        }
      } catch (err) {
        console.error('Error loading preferences:', err);
      }
    };

    const updatePreferences = async () => {
      try {
        const response = await fetch('/api/user/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(preferences.value)
        });
        
        if (response.ok) {
          success('Preferences updated');
          
          // Apply theme
          if (preferences.value.theme === 'dark') {
            document.body.classList.add('dark-theme');
          } else {
            document.body.classList.remove('dark-theme');
          }
        }
      } catch (err) {
        error('Failed to update preferences');
      }
    };

    const downloadData = async () => {
      try {
        const response = await fetch('/api/user/data/download');
        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'my-data.json';
          a.click();
          window.URL.revokeObjectURL(url);
          success('Data downloaded successfully');
        }
      } catch (err) {
        error('Failed to download data');
      }
    };

    const deleteAccount = async () => {
      try {
        const response = await fetch('/api/user/account', {
          method: 'DELETE'
        });
        
        if (response.ok) {
          await logout();
          router.push('/');
        }
      } catch (err) {
        error('Failed to delete account');
      }
    };

    const logoutAllDevices = async () => {
      try {
        const response = await fetch('/api/auth/logout-all', {
          method: 'POST'
        });
        
        if (response.ok) {
          success('Logged out from all devices');
          await logout();
          router.push('/');
        }
      } catch (err) {
        error('Failed to logout from all devices');
      }
    };

    const loadAdminData = async () => {
      if (!user.value?.is_admin) return;
      
      try {
        const response = await fetch('/api/admin/users');
        if (response.ok) {
          const data = await response.json();
          totalUsers.value = data.total;
          recentUsers.value = data.users;
        }
      } catch (err) {
        console.error('Error loading admin data:', err);
      }
    };

    const toggleAdmin = async (targetUser) => {
      try {
        const response = await fetch(`/api/admin/users/${targetUser.id}/toggle-admin`, {
          method: 'POST'
        });
        
        if (response.ok) {
          targetUser.is_admin = !targetUser.is_admin;
          success(`Admin status updated for ${targetUser.name}`);
        }
      } catch (err) {
        error('Failed to update admin status');
      }
    };

    onMounted(() => {
      if (!isAuthenticated.value) {
        router.push('/');
        return;
      }
      
      
      loadPreferences();
      loadAdminData();
    });

    return {
      user,
      activeTab,
      tabs,
      preferences,
      showDeleteConfirm,
      totalUsers,
      recentUsers,
      formatDate,
      updatePreferences,
      downloadData,
      deleteAccount,
      logoutAllDevices,
      toggleAdmin
    };
  }
};
</script>

<style scoped>
.account-page {
  min-height: 100vh;
  background: #f5f5f5;
}

.account-header {
  background: #2d2d2d;
  color: white;
  padding: 1rem 0;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.back-link {
  color: #ccc;
  text-decoration: none;
  font-size: 0.9rem;
  display: inline-block;
  margin-bottom: 0.5rem;
  transition: color 0.2s;
}

.back-link:hover {
  color: white;
}

.account-header h1 {
  margin: 0;
  font-size: 2rem;
}

.account-container {
  max-width: 1200px;
  margin: 2rem auto;
  padding: 0 2rem;
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 2rem;
}

.account-sidebar {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  height: fit-content;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.account-nav {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: none;
  background: none;
  color: #666;
  font-size: 1rem;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
  text-align: left;
  width: 100%;
}

.nav-item:hover {
  background: #f5f5f5;
  color: #333;
}

.nav-item.active {
  background: #4a7c59;
  color: white;
}

.nav-icon {
  font-size: 1.2rem;
}

.account-content {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.tab-content h2 {
  margin: 0 0 2rem 0;
  color: #333;
}

.profile-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 2rem;
  margin-bottom: 2rem;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.profile-avatar {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.profile-details h3 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 1.5rem;
}

.profile-details p {
  margin: 0 0 0.5rem 0;
  color: #666;
}

.admin-badge {
  display: inline-block;
  background: #4CAF50;
  color: white;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 0.85rem;
}

.profile-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
}

.stat-label {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
}

.stat-value {
  color: #333;
  font-size: 1.1rem;
  font-weight: 500;
}

.google-info {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
}

.google-info h3 {
  margin: 0 0 1rem 0;
  color: #333;
}

.google-info p {
  color: #666;
  margin: 0 0 1rem 0;
}

.external-link {
  color: #4a7c59;
  text-decoration: none;
  font-weight: 500;
}

.external-link:hover {
  text-decoration: underline;
}

.preference-section {
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid #e0e0e0;
}

.preference-section:last-child {
  border-bottom: none;
}

.preference-section h3 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1.2rem;
}

.preference-item {
  margin-bottom: 1.5rem;
}

.preference-item label {
  display: block;
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.preference-item select {
  width: 100%;
  max-width: 300px;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  background: white;
}

.checkbox-item label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #333;
  font-size: 1rem;
  cursor: pointer;
}

.checkbox-item input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.preference-description {
  margin: 0.5rem 0 0 1.75rem;
  color: #666;
  font-size: 0.9rem;
}

.privacy-section {
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid #e0e0e0;
}

.privacy-section:last-child {
  border-bottom: none;
}

.privacy-section h3 {
  margin: 0 0 1rem 0;
  color: #333;
}

.privacy-section p {
  color: #666;
  margin: 0 0 1rem 0;
}

.privacy-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}

.secondary-btn {
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.secondary-btn:hover {
  background: #5a6268;
}

.danger-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.danger-btn:hover {
  background: #c82333;
}

.admin-section {
  margin-bottom: 2rem;
}

.admin-section h3 {
  margin: 0 0 1rem 0;
  color: #333;
}

.admin-section p {
  color: #666;
  margin: 0 0 1rem 0;
}

.user-list {
  margin-top: 2rem;
}

.user-list h4 {
  margin: 0 0 1rem 0;
  color: #333;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
}

.admin-table th {
  background: #f8f9fa;
  padding: 0.75rem;
  text-align: left;
  font-weight: 600;
  color: #333;
  border-bottom: 2px solid #dee2e6;
}

.admin-table td {
  padding: 0.75rem;
  border-bottom: 1px solid #dee2e6;
}

.status-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.85rem;
  background: #e9ecef;
  color: #495057;
}

.status-badge.admin {
  background: #d4edda;
  color: #155724;
}

.small-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.2s;
}

.small-btn:hover {
  background: #0056b3;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  max-width: 400px;
  width: 100%;
}

.modal-content h3 {
  margin: 0 0 1rem 0;
  color: #333;
}

.modal-content p {
  color: #666;
  margin: 0 0 1.5rem 0;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .account-container {
    grid-template-columns: 1fr;
  }
  
  .account-sidebar {
    position: sticky;
    top: 1rem;
  }
  
  .account-nav {
    flex-direction: row;
    overflow-x: auto;
  }
  
  .nav-item {
    white-space: nowrap;
  }
}
</style>