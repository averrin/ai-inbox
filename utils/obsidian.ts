import * as Linking from 'expo-linking';
import { Alert } from 'react-native';

/**
 * Opens a file in Obsidian using the obsidian:// URI scheme.
 * Extracts the vault-relative path from the full content:// URI.
 * 
 * @param vaultUri The vault root URI (e.g., content://...tree/primary%3ADocuments%2FVault)
 * @param filePath The full file URI returned by saveToVault
 */
export const openInObsidian = async (vaultUri: string, filePath: string) => {
    try {
        // Extract the vault-relative path by removing the vault URI prefix
        // filePath looks like: content://.../document/primary:Documents/Vault/Inbox/TODO/MyNote.md
        // vaultUri looks like: content://.../tree/primary:Documents/Vault

        // Decode both URIs
        const decodedFilePath = decodeURIComponent(filePath);
        const decodedVaultUri = decodeURIComponent(vaultUri);

        // Extract the vault base path from the vaultUri
        // From "content://.../tree/primary:Documents/Vault" extract "primary:Documents/Vault"
        const vaultBaseMatch = decodedVaultUri.match(/tree\/(.+)$/);
        if (!vaultBaseMatch) {
            console.error('[Linking] Could not extract vault base from URI:', decodedVaultUri);
            Alert.alert('Error', 'Could not determine vault path');
            return;
        }
        const vaultBase = vaultBaseMatch[1];

        // Extract the file path from filePath
        // From "content://.../document/primary:Documents/Vault/Inbox/TODO/MyNote.md" extract "primary:Documents/Vault/Inbox/TODO/MyNote.md"
        const filePathMatch = decodedFilePath.match(/document\/(.+)$/);
        if (!filePathMatch) {
            console.error('[Linking] Could not extract file path from URI:', decodedFilePath);
            Alert.alert('Error', 'Could not determine file path');
            return;
        }
        const fullPath = filePathMatch[1];

        // Remove the vault base from the full path to get relative path
        // If vaultBase is "primary:Documents/Vault" and fullPath is "primary:Documents/Vault/Inbox/TODO/MyNote.md"
        // Result should be "Inbox/TODO/MyNote.md"
        let relativePath = fullPath;
        if (fullPath.startsWith(vaultBase)) {
            relativePath = fullPath.substring(vaultBase.length);
            // Remove leading slash if present
            if (relativePath.startsWith('/')) {
                relativePath = relativePath.substring(1);
            }
        }

        console.log('[Linking] Vault base:', vaultBase);
        console.log('[Linking] Full file path:', fullPath);
        console.log('[Linking] Relative path:', relativePath);

        // Encode the relative path for the URI
        const encodedPath = encodeURIComponent(relativePath);
        const url = `obsidian://open?file=${encodedPath}`;

        console.log('[Linking] Opening Obsidian URI:', url);

        // Short delay to ensure file operations are finalized
        await new Promise(resolve => setTimeout(resolve, 300));

        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
            await Linking.openURL(url);
        } else {
            console.warn('[Linking] Cannot open URL (canOpenURL returned false):', url);
            // Attempt to open anyway as fallback
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
