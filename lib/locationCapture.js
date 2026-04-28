export function isLocationSupported() {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

export function getCurrentExpenseLocation(timeout = 1800) {
  if (!isLocationSupported()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: roundCoordinate(position.coords.latitude),
          longitude: roundCoordinate(position.coords.longitude),
          accuracy: Math.round(position.coords.accuracy || 0),
          capturedAt: new Date().toISOString()
        });
      },
      () => resolve(null),
      {
        enableHighAccuracy: false,
        maximumAge: 5 * 60 * 1000,
        timeout
      }
    );
  });
}

export function getMapsUrl(location) {
  if (!location?.latitude || !location?.longitude) {
    return "";
  }

  return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
}

function roundCoordinate(value) {
  return Math.round(value * 1000000) / 1000000;
}
