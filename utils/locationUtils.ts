import * as Location from 'expo-location';
import { useSettingsStore } from '../store/settings';

export const updateUserLocation = async () => {
    try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            console.warn('[Location] Permission to access location was denied');
            return;
        }

        const location = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = location.coords;

        let city = 'Current Location';
        try {
            const reverseGeocoded = await Location.reverseGeocodeAsync({
                latitude,
                longitude
            });

            if (reverseGeocoded.length > 0) {
                const address = reverseGeocoded[0];
                // Try to find the most relevant name
                city = address.city || address.region || address.subregion || address.country || 'Current Location';

                // If we have a city and a region (like San Francisco, CA), maybe format it?
                // But let's keep it simple for now, just the main identifier.
            }
        } catch (e) {
            console.warn('[Location] Failed to reverse geocode', e);
        }

        useSettingsStore.getState().setWeatherLocation({
            lat: latitude,
            lon: longitude,
            city
        });

        console.log(`[Location] Updated to ${city} (${latitude}, ${longitude})`);

    } catch (error) {
        console.error('[Location] Error getting location:', error);
    }
};
