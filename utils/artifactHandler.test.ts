
import { downloadAndInstallArtifact } from './artifactHandler';
import { Artifact } from '../services/julesTypes';

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
    createDownloadResumable: (url: string, uri: string, options: any) => ({
        downloadAsync: async () => ({ uri })
    }),
    readAsStringAsync: async () => mockZipContent,
    writeAsStringAsync: async () => {},
    getContentUriAsync: async (uri: string) => uri.replace('file://', 'content://'),
    EncodingType: { Base64: 'base64' }
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

const mockJSZip = {
    loadAsync: async (content: string, options: any) => {
        return {
            forEach: (cb: (path: string, file: any) => void) => {
                // Simulate APK file
                cb('app.apk', {
                    async: async (type: string) => mockApkContent
                });
            }
        };
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
    JSZip: mockJSZip,
    Platform: mockPlatform,
    Alert: mockAlert
};

(async () => {
    await runTest('Download and Install APK on Android', async () => {
        let downloading = false;
        const setDownloading = (val: boolean) => downloading = val;

        // Spy on intent
        let intentCalled = false;
        mockIntentLauncher.startActivityAsync = async (action, options) => {
            if (action === 'android.intent.action.VIEW' && options.type === 'application/vnd.android.package-archive') {
                intentCalled = true;
            }
        };

        // Reset deps
        mockPlatform.OS = 'android';

        await downloadAndInstallArtifact(mockArtifact, 'token', 'branch', setDownloading, mockDeps as any);

        if (!intentCalled) throw new Error('IntentLauncher not called for app-release on Android');
        if (downloading) throw new Error('Downloading state not reset');
    });

    await runTest('Share Zip on iOS', async () => {
        mockPlatform.OS = 'ios';

        let shareCalled = false;
        mockSharing.shareAsync = async (uri) => {
            if (uri.endsWith('.zip')) shareCalled = true;
        };

        await downloadAndInstallArtifact(mockArtifact, 'token', 'branch', () => {}, mockDeps as any);

        if (!shareCalled) throw new Error('Sharing not called on iOS');
    });

    await runTest('Share Zip if not app-release on Android', async () => {
        mockPlatform.OS = 'android';
        const otherArtifact = { ...mockArtifact, name: 'other-artifact' };

        let shareCalled = false;
        mockSharing.shareAsync = async (uri) => {
            if (uri.endsWith('.zip')) shareCalled = true;
        };

        await downloadAndInstallArtifact(otherArtifact, 'token', 'branch', () => {}, mockDeps as any);

        if (!shareCalled) throw new Error('Sharing not called for non-app-release');
    });

    console.log("All tests passed!");
})();
