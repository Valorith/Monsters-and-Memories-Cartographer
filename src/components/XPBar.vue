<template>
  <div class="xp-bar-container" v-if="user">
    <div class="xp-info">
      <div class="level-badge" @click="toggleLeaderboard" :class="{ 'clickable': true }">
        <div class="level-number">{{ currentLevel }}</div>
        <div class="level-label">Level</div>
      </div>
      <div class="xp-details">
        <div class="xp-text">
          <span class="current-xp">{{ displayXP }}</span>
          <span class="separator">/</span>
          <span class="next-level-xp">{{ xpRequiredForNextLevel }}</span>
          <span class="xp-label">XP</span>
        </div>
        <div class="xp-bar-wrapper">
          <div class="xp-bar-background">
            <div class="xp-bar-fill" :style="{ width: animatedProgress + '%' }">
              <div class="xp-bar-glow"></div>
            </div>
            <div class="xp-bar-segments">
              <div v-for="i in 10" :key="i" class="xp-segment"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- XP Change Popup -->
    <div v-if="showXPChange" class="xp-change-popup" :class="{ positive: xpChangeAmount > 0 }">
      {{ xpChangeAmount > 0 ? '+' : '' }}{{ xpChangeAmount }} XP
    </div>
    
    <!-- Leaderboard Dropdown -->
    <div v-if="showLeaderboard" class="leaderboard-dropdown">
      <div class="leaderboard-header">
        <h3>Top 10 Champions</h3>
        <button @click="showLeaderboard = false" class="close-button">×</button>
      </div>
      <div class="leaderboard-content">
        <div v-if="loadingLeaderboard" class="loading">Loading...</div>
        <div v-else-if="leaderboardError" class="error">Failed to load leaderboard</div>
        <div v-else-if="leaderboardData.length === 0" class="empty-state">No entries. Be the first!</div>
        <div v-else class="leaderboard-list">
          <div v-for="(player, index) in leaderboardData" :key="player.id" 
               class="leaderboard-item" :class="{ 'current-user': player.id === user.id }">
            <div class="rank">{{ index + 1 }}</div>
            <img v-if="player.avatar" :src="player.avatar" :alt="player.display_name" class="player-avatar" />
            <div v-else class="player-avatar-placeholder">{{ player.display_name[0] }}</div>
            <div class="player-info">
              <div class="player-name">{{ player.display_name }}</div>
              <div class="player-level">Level {{ player.level }} • {{ player.xp }} XP</div>
              <div class="player-xp-bar">
                <div class="player-xp-fill" :style="{ width: player.progressPercent + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, ref, onMounted, watch, onBeforeUnmount } from 'vue';
import { getXPProgress, getTotalXPForLevel } from '../utils/xpCalculator.js';
import { useCSRF } from '../composables/useCSRF.js';

export default {
  name: 'XPBar',
  props: {
    user: {
      type: Object,
      default: null
    }
  },
  setup(props) {
    const { fetchWithCSRF } = useCSRF();
    const animatedProgress = ref(0);
    const displayXP = ref(0);
    const showXPChange = ref(false);
    const xpChangeAmount = ref(0);
    const animationInProgress = ref(false);
    const showLeaderboard = ref(false);
    const leaderboardData = ref([]);
    const loadingLeaderboard = ref(false);
    const leaderboardError = ref(false);

    const xpProgress = computed(() => {
      if (!props.user?.xp) return getXPProgress(0);
      return getXPProgress(props.user.xp);
    });

    const currentLevel = computed(() => xpProgress.value.level);
    const progressPercent = computed(() => xpProgress.value.progressPercent);
    const xpIntoCurrentLevel = computed(() => xpProgress.value.xpIntoLevel);
    const xpRequiredForNextLevel = computed(() => {
      const nextLevel = currentLevel.value + 1;
      return currentLevel.value * currentLevel.value * 100;
    });

    // Animate XP changes
    const animateXPChange = async (oldXP, newXP) => {
      if (animationInProgress.value) return;
      animationInProgress.value = true;

      const change = newXP - oldXP;
      if (change === 0) {
        animationInProgress.value = false;
        return;
      }

      // Show change popup
      xpChangeAmount.value = change;
      showXPChange.value = true;

      // Animate the progress bar
      const oldProgress = getXPProgress(oldXP);
      const newProgress = getXPProgress(newXP);
      
      const duration = 1000; // 1 second animation
      const steps = 60;
      const stepDuration = duration / steps;
      
      for (let i = 0; i <= steps; i++) {
        const progress = i / steps;
        const currentXP = Math.round(oldXP + (change * progress));
        const currentProgressData = getXPProgress(currentXP);
        
        displayXP.value = currentProgressData.xpIntoLevel;
        animatedProgress.value = currentProgressData.progressPercent;
        
        await new Promise(resolve => setTimeout(resolve, stepDuration));
      }

      // Hide change popup after a delay
      setTimeout(() => {
        showXPChange.value = false;
        xpChangeAmount.value = 0;
      }, 2500);

      animationInProgress.value = false;
    };

    // Toggle leaderboard dropdown
    const toggleLeaderboard = async () => {
      if (showLeaderboard.value) {
        showLeaderboard.value = false;
        return;
      }
      
      showLeaderboard.value = true;
      loadingLeaderboard.value = true;
      leaderboardError.value = false;
      
      try {
        const response = await fetch('/api/leaderboard/top10');
        if (!response.ok) throw new Error('Failed to fetch leaderboard');
        
        const data = await response.json();
        leaderboardData.value = data;
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
        leaderboardError.value = true;
      } finally {
        loadingLeaderboard.value = false;
      }
    };

    // Handle click outside to close leaderboard
    const handleClickOutside = (event) => {
      const leaderboardEl = document.querySelector('.leaderboard-dropdown');
      const levelBadgeEl = document.querySelector('.level-badge');
      
      if (showLeaderboard.value && 
          leaderboardEl && 
          !leaderboardEl.contains(event.target) && 
          !levelBadgeEl.contains(event.target)) {
        showLeaderboard.value = false;
      }
    };

    // Check for pending XP on mount
    onMounted(async () => {
      // Add click outside listener
      document.addEventListener('click', handleClickOutside);
      if (props.user) {
        displayXP.value = xpIntoCurrentLevel.value;
        animatedProgress.value = progressPercent.value;

        // Update visit timestamp
        await fetchWithCSRF('/api/auth/update-visit', { method: 'POST' });

        // Check for pending XP changes
        try {
          const response = await fetch('/api/auth/pending-xp');
          if (response.ok) {
            const data = await response.json();
            if (data.totalChange !== 0) {
              const oldXP = data.currentXP - data.totalChange;
              await animateXPChange(oldXP, data.currentXP);
            }
          }
        } catch (error) {
          console.error('Error checking pending XP:', error);
        }
      }
    });

    // Watch for real-time XP changes
    watch(() => props.user?.xp, async (newXP, oldXP) => {
      if (newXP !== undefined && oldXP !== undefined && newXP !== oldXP && !animationInProgress.value) {
        await animateXPChange(oldXP, newXP);
      }
    });

    // Cleanup on unmount
    onBeforeUnmount(() => {
      document.removeEventListener('click', handleClickOutside);
    });

    return {
      currentLevel,
      animatedProgress,
      displayXP,
      xpRequiredForNextLevel,
      showXPChange,
      xpChangeAmount,
      showLeaderboard,
      leaderboardData,
      loadingLeaderboard,
      leaderboardError,
      toggleLeaderboard
    };
  }
};
</script>

<style scoped>
.xp-bar-container {
  display: flex;
  padding: 8px 20px;
  background: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.1));
  border-bottom: 2px solid #2a1810;
  box-shadow: 0 2px 10px rgba(0,0,0,0.5);
  position: relative;
}

.xp-info {
  display: flex;
  align-items: center;
  gap: 20px;
  width: 100%;
}

.level-badge {
  background: radial-gradient(circle, #FFD700, #FFA500);
  border: 3px solid #8B4513;
  border-radius: 50%;
  width: 60px;
  height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 
    0 0 20px rgba(255, 215, 0, 0.5),
    inset 0 0 10px rgba(139, 69, 19, 0.3);
  position: relative;
  animation: pulse 2s ease-in-out infinite;
}

.level-badge.clickable {
  cursor: pointer;
  transition: transform 0.2s ease;
}

.level-badge.clickable:hover {
  transform: scale(1.1);
  box-shadow: 
    0 0 30px rgba(255, 215, 0, 0.8),
    inset 0 0 15px rgba(139, 69, 19, 0.5);
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 
      0 0 20px rgba(255, 215, 0, 0.5),
      inset 0 0 10px rgba(139, 69, 19, 0.3);
  }
  50% {
    box-shadow: 
      0 0 30px rgba(255, 215, 0, 0.8),
      inset 0 0 15px rgba(139, 69, 19, 0.5);
  }
}

.level-number {
  font-size: 24px;
  font-weight: bold;
  color: #2a1810;
  text-shadow: 1px 1px 2px rgba(255, 255, 255, 0.5);
  font-family: 'Georgia', serif;
}

.level-label {
  font-size: 10px;
  color: #2a1810;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: bold;
}

.xp-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.xp-text {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: #FFD700;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
  font-family: 'Georgia', serif;
}

.current-xp {
  font-size: 18px;
  font-weight: bold;
}

.separator {
  font-size: 16px;
  color: #FFA500;
}

.next-level-xp {
  font-size: 16px;
  color: #FFA500;
}

.xp-label {
  font-size: 14px;
  margin-left: 4px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.xp-bar-wrapper {
  width: 100%;
  height: 24px;
  position: relative;
}

.xp-bar-background {
  width: 100%;
  height: 100%;
  background: linear-gradient(to bottom, #1a0f08, #2a1810);
  border: 2px solid #8B4513;
  border-radius: 12px;
  box-shadow: 
    inset 0 2px 5px rgba(0, 0, 0, 0.8),
    0 1px 3px rgba(0, 0, 0, 0.5);
  position: relative;
  overflow: hidden;
}

.xp-bar-fill {
  height: 100%;
  background: linear-gradient(to right, #FF6B35, #FFD700, #FFA500);
  border-radius: 10px;
  position: relative;
  transition: width 0.05s linear;
  box-shadow: 
    0 0 10px rgba(255, 215, 0, 0.5),
    inset 0 -2px 5px rgba(255, 107, 53, 0.3);
}

.xp-bar-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50%;
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.4), transparent);
  border-radius: 10px 10px 0 0;
}

.xp-bar-segments {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: 2px;
  padding: 2px;
}

.xp-segment {
  flex: 1;
  border-right: 1px solid rgba(0, 0, 0, 0.3);
}

.xp-segment:last-child {
  border-right: none;
}

.level-number,
.xp-text {
  font-family: 'Cinzel', 'Georgia', serif;
}

/* Responsive design */
@media (max-width: 768px) {
  .xp-bar-container {
    padding: 6px 15px;
  }

  .level-badge {
    width: 50px;
    height: 50px;
  }

  .level-number {
    font-size: 20px;
  }

  .xp-bar-wrapper {
    width: 100%;
    height: 20px;
  }

  .current-xp {
    font-size: 16px;
  }

  .next-level-xp {
    font-size: 14px;
  }
}

/* XP Change Popup */
.xp-change-popup {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 32px;
  font-weight: bold;
  color: #dc3545;
  text-shadow: 
    2px 2px 4px rgba(0, 0, 0, 0.9),
    0 0 20px currentColor;
  font-family: 'Cinzel', 'Georgia', serif;
  animation: xpPopup 2.5s ease-out forwards;
  pointer-events: none;
  z-index: 100;
  background: rgba(0, 0, 0, 0.7);
  padding: 4px 12px;
  border-radius: 8px;
  border: 2px solid currentColor;
}

.xp-change-popup.positive {
  color: #4dff4d;
  text-shadow: 
    2px 2px 4px rgba(0, 0, 0, 0.9),
    0 0 30px rgba(76, 255, 76, 0.8);
}

@keyframes xpPopup {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.8);
  }
  20% {
    opacity: 1;
    transform: translate(-50%, -60%) scale(1.1);
  }
  30% {
    opacity: 1;
    transform: translate(-50%, -65%) scale(1);
  }
  80% {
    opacity: 1;
    transform: translate(-50%, -70%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -80%) scale(0.9);
  }
}

/* Leaderboard Dropdown */
.leaderboard-dropdown {
  position: absolute;
  top: calc(100% + 10px);
  left: 20px;
  width: 400px;
  max-width: calc(100vw - 40px);
  background: linear-gradient(to bottom, #2a1810, #1a0f08);
  border: 3px solid #8B4513;
  border-radius: 8px;
  box-shadow: 
    0 10px 30px rgba(0, 0, 0, 0.8),
    inset 0 1px 0 rgba(255, 215, 0, 0.3),
    inset 0 -1px 0 rgba(0, 0, 0, 0.5);
  z-index: 1000;
  font-family: 'Cinzel', 'Georgia', serif;
}

.leaderboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 2px solid #8B4513;
  background: linear-gradient(to bottom, rgba(255, 215, 0, 0.1), transparent);
}

.leaderboard-header h3 {
  margin: 0;
  font-size: 20px;
  color: #FFD700;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
  font-weight: 600;
  letter-spacing: 1px;
}

.close-button {
  background: none;
  border: none;
  color: #FFD700;
  font-size: 28px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-button:hover {
  background: rgba(255, 215, 0, 0.2);
  color: #FFA500;
  transform: rotate(90deg);
}

.leaderboard-content {
  max-height: 500px;
  overflow-y: auto;
  padding: 8px;
}

.leaderboard-content::-webkit-scrollbar {
  width: 8px;
}

.leaderboard-content::-webkit-scrollbar-track {
  background: #1a0f08;
  border-radius: 4px;
}

.leaderboard-content::-webkit-scrollbar-thumb {
  background: #8B4513;
  border-radius: 4px;
}

.leaderboard-content::-webkit-scrollbar-thumb:hover {
  background: #A0522D;
}

.loading, .error, .empty-state {
  text-align: center;
  padding: 40px;
  color: #FFA500;
  font-size: 16px;
}

.error {
  color: #dc3545;
}

.empty-state {
  color: #FFD700;
  font-style: italic;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
}

.leaderboard-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.leaderboard-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(139, 69, 19, 0.5);
  border-radius: 6px;
  transition: all 0.2s ease;
}

.leaderboard-item:hover {
  background: rgba(255, 215, 0, 0.1);
  border-color: rgba(255, 215, 0, 0.3);
  transform: translateX(4px);
}

.leaderboard-item.current-user {
  background: rgba(255, 215, 0, 0.15);
  border-color: #FFD700;
  box-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
}

.rank {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: bold;
  color: #2a1810;
  background: radial-gradient(circle, #FFD700, #FFA500);
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}

.leaderboard-item:nth-child(1) .rank {
  background: radial-gradient(circle, #FFD700, #FF8C00);
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.6);
  font-size: 20px;
}

.leaderboard-item:nth-child(2) .rank {
  background: radial-gradient(circle, #C0C0C0, #808080);
}

.leaderboard-item:nth-child(3) .rank {
  background: radial-gradient(circle, #CD7F32, #8B4513);
}

.player-avatar, .player-avatar-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid #8B4513;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}

.player-avatar {
  object-fit: cover;
}

.player-avatar-placeholder {
  background: linear-gradient(135deg, #8B4513, #A0522D);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: bold;
  color: #FFD700;
  text-transform: uppercase;
}

.player-info {
  flex: 1;
  min-width: 0;
}

.player-name {
  font-size: 16px;
  font-weight: 600;
  color: #FFD700;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-level {
  font-size: 14px;
  color: #FFA500;
  margin: 2px 0 4px;
}

.player-xp-bar {
  width: 100%;
  height: 8px;
  background: linear-gradient(to bottom, #1a0f08, #0a0504);
  border: 1px solid #8B4513;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.8);
}

.player-xp-fill {
  height: 100%;
  background: linear-gradient(to right, #FF6B35, #FFD700, #FFA500);
  box-shadow: 0 0 5px rgba(255, 215, 0, 0.5);
  transition: width 0.3s ease;
}

@media (max-width: 768px) {
  .leaderboard-dropdown {
    width: calc(100vw - 20px);
    left: 10px;
  }
  
  .leaderboard-header h3 {
    font-size: 18px;
  }
  
  .leaderboard-item {
    padding: 10px;
    gap: 10px;
  }
  
  .player-avatar, .player-avatar-placeholder {
    width: 36px;
    height: 36px;
  }
  
  .player-name {
    font-size: 15px;
  }
  
  .player-level {
    font-size: 13px;
  }
}
</style>