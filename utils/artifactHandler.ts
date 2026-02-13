import { Artifact } from '../services/julesApi';
import type { ArtifactDeps } from './artifactDeps';

export async function downloadAndInstallArtifact(
    artifact: Artifact,
    token: string,
    branch: string,
    setDownloading: (downloading: boolean) => void,
    onProgress: (progress: number) => void,
    deps: ArtifactDeps
) {
    if (!artifact) return;
    setDownloading(true);
    onProgress(0);

    try {
        console.log(`[Artifact] Starting download for ${artifact.name} from ${artifact.archive_download_url}`);
        const sanitizedBranch = (branch || 'unknown').replace(/[^a-zA-Z0-9-_]/g, '_');
        const sanitizedArtifactName = artifact.name.replace(/[^a-zA-Z0-9-_]/g, '_');
        const zipFilename = `${sanitizedArtifactName}-${sanitizedBranch}.zip`;
        const zipFileUri = deps.FileSystem.cacheDirectory + zipFilename;

        // 1. Download the zip
        // GitHub artifact API returns a 302 redirect to Azure Blob Storage.
        // If we send the Authorization header to the redirect target, the download
        // returns corrupted data (Azure rejects/ignores the Bearer token).
        // We resolve the final URL by following the redirect with fetch, then
        // re-download from that URL without the auth header.
        console.log(`[Artifact] Resolving redirect for artifact URL...`);
        const redirectResponse = await fetch(artifact.archive_download_url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json',
            },
        });
        // response.url gives us the final URL after all redirects
        const finalUrl = redirectResponse.url;
        const wasRedirected = finalUrl !== artifact.archive_download_url;
        console.log(`[Artifact] Resolved download URL (redirected: ${wasRedirected})`);

        // Abort the body — we only needed the final URL
        try { await redirectResponse.body?.cancel(); } catch (_) {}

        if (!wasRedirected) {
            // No redirect happened — the response itself may contain the data.
            // This shouldn't normally happen with the GitHub API, but handle it.
            console.warn(`[Artifact] No redirect detected, status: ${redirectResponse.status}`);
        }

        // Download from the final (Azure) URL without auth headers
        const downloadResumable = deps.FileSystem.createDownloadResumable(
            finalUrl,
            zipFileUri,
            {},
            (progress) => {
                const percent = progress.totalBytesWritten / progress.totalBytesExpectedToWrite;
                onProgress(percent);
            }
        );

        const result = await downloadResumable.downloadAsync();
        console.log(`[Artifact] Download finished: ${result?.uri}`);
        if (!result || !result.uri) {
            throw new Error("Download failed");
        }

        try {
            const fileInfo = await deps.FileSystem.getInfoAsync(result.uri);
            if (fileInfo.exists) {
                console.log(`[Artifact] Downloaded file size: ${fileInfo.size} bytes`);
            }
        } catch (e) {
            console.warn("[Artifact] Failed to get file info", e);
        }

        onProgress(1); // Ensure 100%

        // 2. Check if we should try to install it (Android + app-release)
        if (deps.Platform.OS === 'android' && artifact.name === 'app-release') {
            console.log(`[Artifact] Android app-release detected, unzipping...`);
            try {
                // Use native unzip instead of in-memory JSZip to avoid OOM
                const unzipPath = deps.FileSystem.cacheDirectory + 'unzipped/';

                // Ensure directory exists or is clean
                const info = await deps.FileSystem.getInfoAsync(unzipPath);
                if (info.exists) {
                    await deps.FileSystem.deleteAsync(unzipPath, { idempotent: true });
                }
                await deps.FileSystem.makeDirectoryAsync(unzipPath, { intermediates: true });

                // Native unzip — react-native-zip-archive requires raw paths, not file:// URIs
                const stripFileUri = (uri: string) => uri.replace(/^file:\/\//, '');
                await deps.unzip(stripFileUri(result.uri), stripFileUri(unzipPath));
                console.log(`[Artifact] Unzip complete`);

                // Find APK in the unzipped folder (search root and subfolders)
                const findApk = async (dir: string, depth = 0): Promise<string | null> => {
                    if (depth > 5) return null; // Safety limit

                    const files = await deps.FileSystem.readDirectoryAsync(dir);
                    const apk = files.find(f => f.endsWith('.apk'));
                    if (apk) {
                        return dir + (dir.endsWith('/') ? '' : '/') + apk;
                    }

                    for (const file of files) {
                        const path = dir + (dir.endsWith('/') ? '' : '/') + file;
                        try {
                            const info = await deps.FileSystem.getInfoAsync(path);
                            if (info.exists && info.isDirectory) {
                                const found = await findApk(path, depth + 1);
                                if (found) return found;
                            }
                        } catch (err) {
                            // ignore
                        }
                    }
                    return null;
                };

                const apkSourceUri = await findApk(unzipPath);

                if (apkSourceUri) {
                    const apkTargetUri = deps.FileSystem.cacheDirectory + 'app-release.apk';
                    console.log(`[Artifact] Found APK at ${apkSourceUri}, copying to ${apkTargetUri}`);

                    // Move/copy to a predictable name for install
                    await deps.FileSystem.copyAsync({
                        from: apkSourceUri,
                        to: apkTargetUri
                    });

                    // Get content URI
                    const contentUri = await deps.FileSystem.getContentUriAsync(apkTargetUri);
                    console.log(`[Artifact] Launching intent for: ${contentUri}`);

                    // Use native ApkInstaller module which calls startActivity (fire-and-forget)
                    // with proper MIME type. IntentLauncher uses startActivityForResult which
                    // causes the package installer to return immediately without showing UI,
                    // and Linking.openURL doesn't set the MIME type needed for content:// URIs.
                    try {
                        await deps.ApkInstaller.install(contentUri);
                        console.log(`[Artifact] Launched package installer via ApkInstaller native module`);
                    } catch (installError: any) {
                        if (installError?.code === 'APK_PERMISSION_NEEDED') {
                            deps.Alert.alert(
                                "Permission Required",
                                "Please enable 'Install unknown apps' for AI Inbox in the settings screen that just opened, then try downloading again."
                            );
                        } else {
                            throw installError;
                        }
                    }

                    setDownloading(false);
                    return;
                } else {
                    throw new Error("No APK found in the artifact");
                }
            } catch (unzipError: any) {
                console.warn("[Artifact] Native unzip/install failed:", unzipError?.message || unzipError);
                // Fallthrough to share zip
            }
        }

        // 3. Fallback: Share the downloaded zip
        console.log(`[Artifact] Falling back to sharing zip file: ${result.uri}`);
        if (await deps.Sharing.isAvailableAsync()) {
            await deps.Sharing.shareAsync(result.uri);
        } else {
            deps.Alert.alert("Success", "Artifact downloaded to: " + result.uri);
        }

    } catch (e: any) {
        console.error("[Artifact] Critical error in downloadAndInstallArtifact:", e);
        deps.Alert.alert("Error", "Failed to download/install artifact: " + e.message);
    } finally {
        setDownloading(false);
    }
}
