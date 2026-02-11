import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform, Alert } from 'react-native';
import JSZip from 'jszip';

export const artifactDeps = {
    FileSystem,
    Sharing,
    IntentLauncher,
    Platform,
    Alert,
    JSZip
};

export type ArtifactDeps = typeof artifactDeps;
