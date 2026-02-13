
import { downloadAndInstallArtifact } from './artifactHandler';
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
const mockApkContent = 'mock-apk-base64';

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
    getInfoAsync: async (uri: string) => ({ exists: true, isDirectory: uri.endsWith('/') || uri.includes('unzipped'), size: 12345 }),
    deleteAsync: async () => {},
    makeDirectoryAsync: async () => {},
    readDirectoryAsync: async () => ['app.apk'],
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
    await runTest('Download and Install APK on Android', async () => {
        let downloading = false;
        const setDownloading = (val: boolean) => downloading = val;
        const onProgress = (p: number) => {};

        // Spy on ApkInstaller
        let installCalled = false;
        mockApkInstaller.install = async (uri) => {
            installCalled = true;
            return true;
        };

        // Reset deps
        mockPlatform.OS = 'android';

        await downloadAndInstallArtifact(mockArtifact, 'token', 'branch', setDownloading, onProgress, mockDeps as any);

        if (!installCalled) throw new Error('ApkInstaller not called for app-release on Android');
        if (downloading) throw new Error('Downloading state not reset');
    });

    await runTest('Share Zip on iOS', async () => {
        mockPlatform.OS = 'ios';
        const onProgress = (p: number) => {};

        let shareCalled = false;
        mockSharing.shareAsync = async (uri) => {
            if (uri.endsWith('.zip')) shareCalled = true;
        };

        await downloadAndInstallArtifact(mockArtifact, 'token', 'branch', () => { }, onProgress, mockDeps as any);

        if (!shareCalled) throw new Error('Sharing not called on iOS');
    });

    await runTest('Share Zip if not app-release on Android', async () => {
        mockPlatform.OS = 'android';
        const otherArtifact = { ...mockArtifact, name: 'other-artifact' };
        const onProgress = (p: number) => {};

        let shareCalled = false;
        mockSharing.shareAsync = async (uri) => {
            if (uri.endsWith('.zip')) shareCalled = true;
        };

        await downloadAndInstallArtifact(otherArtifact, 'token', 'branch', () => { }, onProgress, mockDeps as any);

        if (!shareCalled) throw new Error('Sharing not called for non-app-release');
    });

    // Test sanitization check
    await runTest('Sanitization check', async () => {
         mockPlatform.OS = 'android';
         const complexArtifact = { ...mockArtifact, name: 'app release v1' }; // Space in name

         // Mock createDownloadResumable to check uri
         let capturedUri = '';
         mockFileSystem.createDownloadResumable = (url, uri) => {
             capturedUri = uri;
             return { downloadAsync: async () => ({ uri }) } as any;
         };

         await downloadAndInstallArtifact(complexArtifact, 'token', 'branch', () => {}, () => {}, mockDeps as any);

         if (!capturedUri.includes('app_release_v1')) {
             throw new Error(`Filename not sanitized correctly: ${capturedUri}`);
         }

         if (!capturedUri.startsWith(mockFileSystem.cacheDirectory)) {
             throw new Error(`Filename not in cache directory: ${capturedUri}`);
         }
    });

    console.log("All tests passed!");
})();
