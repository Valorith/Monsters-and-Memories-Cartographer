// XP calculation utilities

// Calculate level from XP
export function getLevelFromXP(xp) {
  if (xp < 0) return 1;
  
  // Level formula: XP needed for level N = N * N * 100
  // Level 1 = 0 XP (starting level)
  // Level 2 = 100 XP (1*1*100)
  // Level 3 = 100 + 400 = 500 XP (1*1*100 + 2*2*100)
  // Level 4 = 100 + 400 + 900 = 1400 XP
  
  let level = 1;
  let totalXPRequired = 0;
  
  while (true) {
    const xpForThisLevel = level * level * 100;
    if (xp < totalXPRequired + xpForThisLevel) {
      return level;
    }
    totalXPRequired += xpForThisLevel;
    level++;
  }
}

// Calculate total XP required for a specific level
export function getTotalXPForLevel(level) {
  if (level <= 1) return 0;
  
  let totalXP = 0;
  for (let i = 1; i < level; i++) {
    totalXP += i * i * 100;
  }
  return totalXP;
}

// Calculate XP progress within current level
export function getXPProgress(xp) {
  const currentLevel = getLevelFromXP(xp);
  const xpForCurrentLevel = getTotalXPForLevel(currentLevel);
  const xpForNextLevel = getTotalXPForLevel(currentLevel + 1);
  
  const xpIntoCurrentLevel = xp - xpForCurrentLevel;
  const xpNeededForLevel = xpForNextLevel - xpForCurrentLevel;
  
  return {
    level: currentLevel,
    currentXP: xp,
    xpIntoLevel: xpIntoCurrentLevel,
    xpForNextLevel: xpNeededForLevel,
    progress: xpIntoCurrentLevel / xpNeededForLevel,
    progressPercent: Math.floor((xpIntoCurrentLevel / xpNeededForLevel) * 100)
  };
}