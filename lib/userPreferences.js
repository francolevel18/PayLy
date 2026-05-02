const preferencesKey = "payly.preferences";

const defaultPreferences = {
  vibrationEnabled: true,
  swipeSaveEnabled: true,
  locationEnabled: false,
  notificationsEnabled: false,
  reminderHour: 20,
  reminderMode: "scheduled",
  reminderTime: "20:00"
};

export function loadPreferences() {
  if (typeof window === "undefined") {
    return defaultPreferences;
  }

  try {
    return {
      ...defaultPreferences,
      ...(JSON.parse(window.localStorage.getItem(preferencesKey)) || {})
    };
  } catch {
    return defaultPreferences;
  }
}

export function savePreferences(preferences) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(preferencesKey, JSON.stringify({ ...defaultPreferences, ...preferences }));
  } catch {
    // localStorage can fail in private mode or when quota is full.
  }
}
