import { Artifact } from '../services/julesApi';
import type { ArtifactDeps } from './artifactDeps';
import { showAlert, showError } from './alert';

export async function ensureArtifactsDirectory(deps: ArtifactDeps) {
    const dir = deps.FileSystem.documentDirectory + 'artifacts/';
    const info = await deps.FileSystem.getInfoAsync(dir);
    if (!info.exists) {
        await deps.FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    return dir;
}

export async function isArtifactCached(artifact: Artifact, deps: ArtifactDeps): Promise<string | null> {
    const dir = deps.FileSystem.documentDirectory + 'artifacts/';
    const path = dir + `${artifact.id}.apk`;
    const info = await deps.FileSystem.getInfoAsync(path);
    if (info.exists) {
        return path;
    }
    return null;
}

export async function installCachedArtifact(apkUri: string, deps: ArtifactDeps) {
    console.log(`[Artifact] Installing cached artifact from ${apkUri}`);
    // Get content URI
    const contentUri = await deps.FileSystem.getContentUriAsync(apkUri);
    console.log(`[Artifact] Launching intent for: ${contentUri}`);

    try {
        await deps.ApkInstaller.install(contentUri);
        console.log(`[Artifact] Launched package installer via ApkInstaller native module`);
    } catch (installError: any) {
        if (installError?.code === 'APK_PERMISSION_NEEDED') {
            showAlert(
                "Permission Required",
                "Please enable 'Install unknown apps' for AI Inbox in the settings screen that just opened, then try again."
            );
        } else {
            throw installError;
        }
    }
}

async function manageCache(deps: ArtifactDeps) {
    const dir = deps.FileSystem.documentDirectory + 'artifacts/';
    try {
        const files = await deps.FileSystem.readDirectoryAsync(dir);
        const apkFiles = files.filter(f => f.endsWith('.apk'));

        if (apkFiles.length <= 5) return;

        const fileInfos = await Promise.all(apkFiles.map(async (file) => {
            const path = dir + file;
            const info = await deps.FileSystem.getInfoAsync(path);
            return {
                path,
                modificationTime: info.exists ? info.modificationTime || 0 : 0
            };
        }));

        // Sort by modification time descending (newest first)
        fileInfos.sort((a, b) => b.modificationTime - a.modificationTime);

        // Keep top 5, delete the rest
        const toDelete = fileInfos.slice(5);
        for (const file of toDelete) {
            console.log(`[Artifact] Deleting old cached artifact: ${file.path}`);
            await deps.FileSystem.deleteAsync(file.path, { idempotent: true });
        }
    } catch (e) {
        console.warn("[Artifact] Failed to manage cache:", e);
    }
}

export async function downloadAndInstallArtifact(
    artifact: Artifact,
    token: string,
    branch: string,
    setDownloading: (downloading: boolean) => void,
    onProgress: (progress: number) => void,
    deps: ArtifactDeps,
    onStatus?: (status: string) => void,
    onlyDownload: boolean = false
): Promise<string | null> {
    if (!artifact) return null;
    setDownloading(true);
    onProgress(0);
    if (onStatus) onStatus("Checking cache...");

    try {
        // Check cache first
        const cachedPath = await isArtifactCached(artifact, deps);
        if (cachedPath) {
            console.log(`[Artifact] Found cached artifact at ${cachedPath}`);
            if (onlyDownload) {
                setDownloading(false);
                return cachedPath;
            }
            if (onStatus) onStatus("Installing...");
            await installCachedArtifact(cachedPath, deps);
            setDownloading(false);
            return cachedPath;
        }

        if (onStatus) onStatus("Resolving URL...");
        console.log(`[Artifact] Starting download for ${artifact.name} from ${artifact.archive_download_url}`);
        const sanitizedBranch = (branch || 'unknown').replace(/[^a-zA-Z0-9-_]/g, '_');
        const sanitizedArtifactName = artifact.name.replace(/[^a-zA-Z0-9-_]/g, '_');
        const zipFilename = `${sanitizedArtifactName}-${sanitizedBranch}.zip`;
        const zipFileUri = deps.FileSystem.cacheDirectory + zipFilename;

        // 1. Download the zip
        console.log(`[Artifact] Resolving redirect for artifact URL...`);
        const redirectResponse = await fetch(artifact.archive_download_url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json',
            },
            redirect: 'manual'
        });

        let finalUrl = redirectResponse.url;
        let wasRedirected = false;

        if (redirectResponse.status === 301 || redirectResponse.status === 302 || redirectResponse.status === 307 || redirectResponse.status === 308) {
            const location = redirectResponse.headers.get('location');
            if (location) {
                finalUrl = location;
                wasRedirected = true;
                console.log(`[Artifact] Manual redirect captured: ${finalUrl}`);
            }
        } else if (finalUrl !== artifact.archive_download_url) {
            // Fetch followed redirect automatically
            wasRedirected = true;
            console.log(`[Artifact] Auto redirect detected: ${finalUrl}`);
        }

        console.log(`[Artifact] Resolved download URL (redirected: ${wasRedirected})`);

        try { await redirectResponse.body?.cancel(); } catch (_) {}

        if (!wasRedirected) {
            console.warn(`[Artifact] No redirect detected, status: ${redirectResponse.status}`);
        }

        if (onStatus) onStatus("Downloading...");

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

        onProgress(1); // Ensure 100%

        // 2. Check if we should try to install it (Android + app-release)
        if (deps.Platform.OS === 'android' && artifact.name === 'app-release') {
            if (onStatus) onStatus("Unzipping...");
            console.log(`[Artifact] Android app-release detected, unzipping...`);
            try {
                const unzipPath = deps.FileSystem.cacheDirectory + 'unzipped/';

                const info = await deps.FileSystem.getInfoAsync(unzipPath);
                if (info.exists) {
                    await deps.FileSystem.deleteAsync(unzipPath, { idempotent: true });
                }
                await deps.FileSystem.makeDirectoryAsync(unzipPath, { intermediates: true });

                const stripFileUri = (uri: string) => uri.replace(/^file:\/\//, '');
                await deps.unzip(stripFileUri(result.uri), stripFileUri(unzipPath));
                console.log(`[Artifact] Unzip complete`);

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
                    await ensureArtifactsDirectory(deps);
                    const apkTargetUri = deps.FileSystem.documentDirectory + 'artifacts/' + `${artifact.id}.apk`;
                    console.log(`[Artifact] Found APK at ${apkSourceUri}, copying to cache: ${apkTargetUri}`);

                    // Copy to persistent cache
                    await deps.FileSystem.copyAsync({
                        from: apkSourceUri,
                        to: apkTargetUri
                    });

                    // Manage cache size
                    await manageCache(deps);

                    if (onlyDownload) {
                        setDownloading(false);
                        return apkTargetUri;
                    }

                    if (onStatus) onStatus("Installing...");
                    await installCachedArtifact(apkTargetUri, deps);
                    setDownloading(false);
                    return apkTargetUri;
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
            showAlert("Success", "Artifact downloaded to: " + result.uri);
        }

    } catch (e: any) {
        console.error("[Artifact] Critical error in downloadAndInstallArtifact:", e);
        showError("Error", "Failed to download/install artifact: " + e.message);
        return null;
    } finally {
        setDownloading(false);
    }
    return null;
}
