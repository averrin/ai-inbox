import { Artifact } from '../services/julesTypes';
import type { ArtifactDeps } from './artifactDeps';

export async function downloadAndInstallArtifact(
    artifact: Artifact,
    token: string,
    branch: string,
    setDownloading: (downloading: boolean) => void,
    deps: ArtifactDeps
) {
    if (!artifact) return;
    setDownloading(true);

    try {
        const sanitizedBranch = (branch || 'unknown').replace(/[^a-zA-Z0-9-_]/g, '_');
        const zipFilename = `${artifact.name}-${sanitizedBranch}.zip`;
        const zipFileUri = deps.FileSystem.documentDirectory + zipFilename;

        // 1. Download the zip
        const downloadResumable = deps.FileSystem.createDownloadResumable(
            artifact.archive_download_url,
            zipFileUri,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        const result = await downloadResumable.downloadAsync();
        if (!result || !result.uri) {
            throw new Error("Download failed");
        }

        // 2. Check if we should try to install it (Android + app-release)
        if (deps.Platform.OS === 'android' && artifact.name === 'app-release') {
            try {
                // Read the zip file as base64
                const zipContent = await deps.FileSystem.readAsStringAsync(result.uri, {
                    encoding: deps.FileSystem.EncodingType.Base64
                });

                // Load zip
                const zip = await deps.JSZip.loadAsync(zipContent, { base64: true });

                // Find APK
                let apkFile = null;
                zip.forEach((relativePath: string, file: any) => {
                    if (relativePath.endsWith('.apk')) {
                        apkFile = file;
                    }
                });

                if (apkFile) {
                    // Extract APK to cache
                    const apkContent = await (apkFile as any).async('base64');
                    const apkUri = deps.FileSystem.cacheDirectory + 'app-release.apk';

                    await deps.FileSystem.writeAsStringAsync(apkUri, apkContent, {
                        encoding: deps.FileSystem.EncodingType.Base64
                    });

                    // Get content URI
                    const contentUri = await deps.FileSystem.getContentUriAsync(apkUri);

                    // Launch intent
                    await deps.IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                        data: contentUri,
                        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
                        type: 'application/vnd.android.package-archive'
                    });

                    setDownloading(false);
                    return;
                }
            } catch (unzipError) {
                console.warn("Failed to unzip/install APK, falling back to share:", unzipError);
                // Fallthrough to share zip
            }
        }

        // 3. Fallback: Share the downloaded zip
        if (await deps.Sharing.isAvailableAsync()) {
            await deps.Sharing.shareAsync(result.uri);
        } else {
            deps.Alert.alert("Success", "Artifact downloaded to: " + result.uri);
        }

    } catch (e: any) {
        console.error(e);
        deps.Alert.alert("Error", "Failed to download/install artifact: " + e.message);
    } finally {
        setDownloading(false);
    }
}
