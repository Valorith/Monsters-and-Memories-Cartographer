import { ref, computed } from 'vue';

const user = ref(null);
const isAuthenticated = computed(() => !!user.value);
const isAdmin = computed(() => user.value?.is_admin || false);
const adminModeEnabled = ref(false);
const loading = ref(true);

export function useAuth() {
  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/status');
      const data = await response.json();
      
      if (data.banned) {
        // User is banned - show alert and clear auth
        alert(`Your account has been banned.\nReason: ${data.banReason || 'No reason provided'}`);
        user.value = null;
        adminModeEnabled.value = false;
      } else if (data.authenticated) {
        user.value = {
          ...data.user,
          // Ensure displayName is set
          displayName: data.user.displayName || data.user.name
        };
        adminModeEnabled.value = data.adminModeEnabled || false;
      } else {
        user.value = null;
        adminModeEnabled.value = false;
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

  return {
    user,
    isAuthenticated,
    isAdmin,
    adminModeEnabled,
    loading,
    checkAuthStatus,
    logout
  };
}