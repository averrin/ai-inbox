
import { downloadAndInstallArtifact, isArtifactCached } from './artifactHandler';
import { Artifact } from '../services/julesApi';

// Manual test runner since no Jest/Test Runner configured
const runTest = async (name: string, fn: () => Promise<void>) => {
    try {
        await fn();
        console.log(`PASS: ${name}`);
    } catch (e: any) {
        console.error(`FAIL: ${name}`, e);
        process.exit(1);
    }
};

const mockArtifact: Artifact = {
    id: 1,
    name: 'app-release',
    size_in_bytes: 1000,
    url: 'http://example.com',
    archive_download_url: 'http://example.com/zip',
    created_at: '2023-01-01',
    expired: false
};

const mockZipContent = 'mock-zip-base64';

// Mocks
const mockFileSystem = {
    documentDirectory: 'file:///doc/',
    cacheDirectory: 'file:///cache/',
    createDownloadResumable: (url: string, uri: string, options: any, callback?: (progress: any) => void) => ({
        downloadAsync: async () => {
            if (callback) callback({ totalBytesWritten: 100, totalBytesExpectedToWrite: 100 });
            return { uri };
        }
    }),
    readAsStringAsync: async () => mockZipContent,
    writeAsStringAsync: async () => { },
    getContentUriAsync: async (uri: string) => uri.replace('file://', 'content://'),
    EncodingType: { Base64: 'base64' },
    getInfoAsync: async (uri: string) => {
        if (uri.includes('artifacts/1.apk')) return { exists: false }; // Default: not cached
        return { exists: true, isDirectory: uri.endsWith('/') || uri.includes('unzipped'), size: 12345, modificationTime: 1000 };
    },
    deleteAsync: async () => {},
    makeDirectoryAsync: async () => {},
    readDirectoryAsync: async (dir: string) => {
        if (dir.includes('unzipped')) return ['app.apk'];
        if (dir.includes('artifacts')) return [];
        return [];
    },
    copyAsync: async () => {}
};

const mockIntentLauncher = {
    startActivityAsync: async (action: string, options: any) => {
        console.log(`Intent launched: ${action}`, options);
    }
};

const mockSharing = {
    isAvailableAsync: async () => true,
    shareAsync: async (uri: string) => {
        console.log(`Shared: ${uri}`);
    }
};

const mockUnzip = async (source: string, target: string) => {
    console.log(`Unzipped ${source} to ${target}`);
};

const mockApkInstaller = {
    install: async (uri: string) => {
        console.log(`ApkInstaller installing: ${uri}`);
        return true;
    }
};

const mockPlatform = {
    OS: 'android' as any
};

const mockAlert = {
    alert: (title: string, msg: string) => console.log(`Alert: ${title} - ${msg}`)
};

const mockDeps = {
    FileSystem: mockFileSystem,
    IntentLauncher: mockIntentLauncher,
    Sharing: mockSharing,
    ApkInstaller: mockApkInstaller,
    Platform: mockPlatform,
    Alert: mockAlert,
    unzip: mockUnzip
};

(async () => {
    await runTest('Download and Install APK on Android with Status', async () => {
        let downloading = false;
        const setDownloading = (val: boolean) => downloading = val;
        const onProgress = (p: number) => {};
        const statuses: string[] = [];
        const onStatus = (s: string) => statuses.push(s);

        // Spy on ApkInstaller
        let installCalled = false;
        mockApkInstaller.install = async (uri) => {
            installCalled = true;
            return true;
        };

        // Reset deps
        mockPlatform.OS = 'android';

        // Mock global.fetch for manual redirect
        const originalFetch = global.fetch;
        global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
            console.log(`Fetch called for: ${url.toString()}`);
            if (url.toString().includes('example.com/zip')) {
                // Simulate manual redirect
                if (init?.redirect === 'manual') {
                    return {
                        status: 302,
                        url: '',
                        headers: {
                            get: (name: string) => name.toLowerCase() === 'location' ? 'http://example.com/final-zip' : null
                        },
                        body: { cancel: async () => {} }
                    } as any;
                } else {
                     // Simulate auto redirect (should not happen with our code change)
                     return {
                        status: 200,
                        url: 'http://example.com/final-zip',
                        headers: { get: () => null },
                        body: { cancel: async () => {} }
                    } as any;
                }
            }
            return originalFetch(url, init);
        };

        // Ensure 1.apk is NOT cached
        mockFileSystem.getInfoAsync = async (uri) => {
             if (uri.includes('artifacts/1.apk')) return { exists: false, isDirectory: false };
             return { exists: true, isDirectory: uri.endsWith('/') || uri.includes('unzipped'), size: 12345 };
        };

        try {
            await downloadAndInstallArtifact(mockArtifact, 'token', 'branch', setDownloading, onProgress, mockDeps as any, onStatus);
        } finally {
            global.fetch = originalFetch;
        }

        if (!installCalled) throw new Error('ApkInstaller not called for app-release on Android');
        if (downloading) throw new Error('Downloading state not reset');
        if (!statuses.includes('Resolving URL...')) throw new Error('Status Resolving URL... missing');
        if (!statuses.includes('Downloading...')) throw new Error('Status Downloading... missing');
        if (!statuses.includes('Unzipping...')) throw new Error('Status Unzipping... missing');
        if (!statuses.includes('Installing...')) throw new Error('Status Installing... missing');
    });

    await runTest('Only Download (skip install)', async () => {
        let downloading = false;
        const setDownloading = (val: boolean) => downloading = val;

        // Spy on ApkInstaller
        let installCalled = false;
        mockApkInstaller.install = async (uri) => {
            installCalled = true;
            return true;
        };

        // Mock fetch again
        const originalFetch = global.fetch;
        global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
            if (url.toString().includes('example.com/zip')) {
                return {
                        status: 302,
                        url: '',
                        headers: {
                            get: (name: string) => name.toLowerCase() === 'location' ? 'http://example.com/final-zip' : null
                        },
                        body: { cancel: async () => {} }
                    } as any;
            }
            return originalFetch(url, init);
        };

        let resultPath;
        try {
            resultPath = await downloadAndInstallArtifact(
                mockArtifact,
                'token',
                'branch',
                setDownloading,
                () => {},
                mockDeps as any,
                () => {},
                true // onlyDownload
            );
        } finally {
            global.fetch = originalFetch;
        }

        if (installCalled) throw new Error('ApkInstaller WAS called when onlyDownload=true');
        if (!resultPath || !resultPath.includes('artifacts/1.apk')) throw new Error('Did not return correct artifact path');
    });

    await runTest('Cache Management', async () => {
        const newArtifact = { ...mockArtifact, id: 999 };

        // Mock existing artifacts
        mockFileSystem.readDirectoryAsync = async (dir) => {
            if (dir.includes('artifacts')) {
                // Return 6 existing files + the new one being added?
                // Wait, manageCache is called AFTER copyAsync.
                // So readDirectoryAsync will find the new one too.
                return ['1.apk', '2.apk', '3.apk', '4.apk', '5.apk', '6.apk', '999.apk'];
            }
            if (dir.includes('unzipped')) return ['app.apk'];
            return [];
        };

        mockFileSystem.getInfoAsync = async (uri) => {
             // New artifact is not cached initially
             if (uri.includes('artifacts/999.apk')) {
                 // But wait, manageCache is called AFTER copy. So it exists then.
                 // But isArtifactCached checks at start.
                 // I need to be careful with when getInfoAsync is called.
                 // isArtifactCached calls it first -> returns false (so it downloads).
                 // copyAsync happens.
                 // manageCache calls readDirectoryAsync -> returns list.
                 // manageCache calls getInfoAsync for each file to sort.
                 // So I should return valid info for all.
                 return { exists: true, modificationTime: 9999 }; // Newest
             }

             if (uri.endsWith('1.apk')) return { exists: true, modificationTime: 100 }; // Oldest
             if (uri.endsWith('2.apk')) return { exists: true, modificationTime: 200 };
             if (uri.endsWith('3.apk')) return { exists: true, modificationTime: 300 };
             if (uri.endsWith('4.apk')) return { exists: true, modificationTime: 400 };
             if (uri.endsWith('5.apk')) return { exists: true, modificationTime: 500 };
             if (uri.endsWith('6.apk')) return { exists: true, modificationTime: 600 };

             // Default for unzipped dir etc
             return { exists: true, isDirectory: uri.endsWith('/') || uri.includes('unzipped') };
        };

        // Spy on delete
        let deletedFiles: string[] = [];
        mockFileSystem.deleteAsync = async (uri) => {
            deletedFiles.push(uri);
        };

        // We also need to ensure isArtifactCached returns false at the start for 999
        // But I can't easily change getInfoAsync behavior based on caller or time without complex mock.
        // Actually, isArtifactCached uses specific path.
        // I can just rely on the fact that for "isArtifactCached" I want false, but later true.
        // But wait, the mock function above returns { exists: true } for 999.
        // So isArtifactCached will return true and SKIP download.
        // I need to return false for the FIRST call for 999.apk, and true for subsequent calls?
        // Or just use a variable.

        let checkedCache = false;
        const originalGetInfo = mockFileSystem.getInfoAsync;
        mockFileSystem.getInfoAsync = async (uri) => {
            if (uri.includes('artifacts/999.apk') && !checkedCache) {
                checkedCache = true;
                return { exists: false, isDirectory: false };
            }
            return originalGetInfo(uri);
        };

        await downloadAndInstallArtifact(newArtifact, 'token', 'branch', () => {}, () => {}, mockDeps as any, () => {});

        // Expect 1.apk and 2.apk to be deleted?
        // We have 7 files total (1..6 + 999). Keep 5. So delete 2 oldest.
        // 1.apk (100) and 2.apk (200).
        if (!deletedFiles.some(f => f.endsWith('1.apk'))) {
             throw new Error('Oldest artifact 1.apk was not deleted');
        }
        if (!deletedFiles.some(f => f.endsWith('2.apk'))) {
             throw new Error('Second oldest artifact 2.apk was not deleted');
        }
    });

    console.log("All tests passed!");
})();
