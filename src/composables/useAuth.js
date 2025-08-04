import { ref, computed } from 'vue';

const user = ref(null);
const isAuthenticated = computed(() => !!user.value);
const isAdmin = computed(() => user.value?.is_admin || false);
const adminModeEnabled = ref(false);
const loading = ref(true);
const unacknowledgedWarnings = ref([]);

export function useAuth() {
  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/status');
      const data = await response.json();
      
      if (data.banned) {
        // User is banned - set user with ban info
        user.value = {
          isBanned: true,
          banReason: data.banReason || null
        };
        adminModeEnabled.value = false;
        unacknowledgedWarnings.value = [];
      } else if (data.authenticated) {
        user.value = {
          ...data.user,
          // Ensure displayName is set
          displayName: data.user.displayName || data.user.name
        };
        adminModeEnabled.value = data.adminModeEnabled || false;
        // Set unacknowledged warnings
        unacknowledgedWarnings.value = data.unacknowledgedWarnings || [];
      } else {
        user.value = null;
        adminModeEnabled.value = false;
        unacknowledgedWarnings.value = [];
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      user.value = null;
    } finally {
      loading.value = false;
    }
  };

  const logout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST'
      });
      
      if (response.ok) {
        user.value = null;
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const acknowledgeWarning = (warningId) => {
    // Remove the acknowledged warning from the list
    unacknowledgedWarnings.value = unacknowledgedWarnings.value.filter(w => w.id !== warningId);
  };

  return {
    user,
    isAuthenticated,
    isAdmin,
    adminModeEnabled,
    loading,
    unacknowledgedWarnings,
    checkAuthStatus,
    logout,
    acknowledgeWarning
  };
}