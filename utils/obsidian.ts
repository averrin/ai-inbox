import * as Linking from 'expo-linking';
import { Alert } from 'react-native';

/**
 * Opens a file in Obsidian using the obsidian:// URI scheme.
 * Handles URI encoding of spaces and special characters.
 * 
 * @param filename The name of the file (e.g., "My Note.md")
 * @param folder The folder path relative to the vault root (e.g., "Inbox")
 */
export const openInObsidian = async (filename: string, folder: string | null | undefined) => {
    try {
        // Construct relative path: Folder/Filename.md or just Filename.md
        const relativePath = folder ? `${folder}/${filename}` : filename;

        // Encode the path for the URI (handles spaces as %20, slashes as %2F)
        const encodedPath = encodeURIComponent(relativePath);
        const url = `obsidian://open?file=${encodedPath}`;

        console.log('[Linking] Opening Obsidian URI:', url);

        // Short delay to ensure any preceding file operations are finalized
        await new Promise(resolve => setTimeout(resolve, 300));

        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
            await Linking.openURL(url);
        } else {
            console.warn('[Linking] Cannot open URL (canOpenURL returned false):', url);
            // Attempt to open anyway as fallback, or alert
            try {
                await Linking.openURL(url);
            } catch (innerErr) {
                Alert.alert('Error', 'Could not open Obsidian. Please make sure the app is installed.');
            }
        }
    } catch (e) {
        console.error('[Linking] Failed to open Obsidian:', e);
        Alert.alert('Error', 'Could not open note in Obsidian');
    }
};
