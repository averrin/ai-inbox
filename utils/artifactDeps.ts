import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform, Alert, NativeModules } from 'react-native';
const { unzip } = require('react-native-zip-archive');

export const artifactDeps = {
    FileSystem,
    Sharing,
    IntentLauncher,
    ApkInstaller: NativeModules.ApkInstaller as { install: (contentUri: string) => Promise<boolean> },
    Platform,
    Alert,
    unzip
};

export type ArtifactDeps = typeof artifactDeps;
