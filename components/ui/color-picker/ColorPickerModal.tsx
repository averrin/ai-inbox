import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GradientSlider } from './GradientSlider';
import { hslToHex, hexToHsl } from './colorUtils';
import { Colors } from '../design-tokens';
import { AppButton, CloseButton } from '../AppButton';

interface ColorPickerModalProps {
    visible: boolean;
    initialColor: string;
    onClose: () => void;
    onSelect: (color: string) => void;
}

export function ColorPickerModal({ visible, initialColor, onClose, onSelect }: ColorPickerModalProps) {
    const [hsl, setHsl] = useState({ h: 0, s: 0, l: 0 });
    const [hex, setHex] = useState(initialColor);

    useEffect(() => {
        if (visible) {
            const newHsl = hexToHsl(initialColor);
            setHsl(newHsl);
            setHex(initialColor);
        }
    }, [visible, initialColor]);

    const handleHueChange = (val: number) => {
        const newH = Math.round(val * 360);
        const newHsl = { ...hsl, h: newH };
        updateColor(newHsl);
    };

    const handleSatChange = (val: number) => {
        const newS = Math.round(val * 100);
        const newHsl = { ...hsl, s: newS };
        updateColor(newHsl);
    };

    const handleLightChange = (val: number) => {
        const newL = Math.round(val * 100);
        const newHsl = { ...hsl, l: newL };
        updateColor(newHsl);
    };

    const updateColor = (newHsl: { h: number, s: number, l: number }) => {
        setHsl(newHsl);
        const newHex = hslToHex(newHsl.h, newHsl.s, newHsl.l);
        setHex(newHex);
    };

    const handleHexChange = (text: string) => {
        setHex(text);
        if (/^#[0-9A-F]{6}$/i.test(text)) {
            setHsl(hexToHsl(text));
        }
    };

    const handleSave = () => {
        onSelect(hex);
        onClose();
    };

    // Derived gradients
    const hueGradient = [
        '#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000'
    ];
    const satGradient = [
        hslToHex(hsl.h, 0, hsl.l),
        hslToHex(hsl.h, 100, hsl.l)
    ];
    const lightGradient = [
        Colors.black,
        hslToHex(hsl.h, hsl.s, 50),
        Colors.white
    ];

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Custom Color</Text>
                        <CloseButton onPress={onClose} />
                    </View>

                    <View style={styles.previewContainer}>
                        <View style={[styles.preview, { backgroundColor: hex }]} />
                        <TextInput
                            style={styles.hexInput}
                            value={hex}
                            onChangeText={handleHexChange}
                            maxLength={7}
                            autoCapitalize="characters"
                        />
                    </View>

                    <View style={styles.sliderContainer}>
                        <Text style={styles.label}>Hue</Text>
                        <GradientSlider
                            colors={hueGradient}
                            value={hsl.h / 360}
                            onChange={handleHueChange}
                        />
                    </View>

                    <View style={styles.sliderContainer}>
                        <Text style={styles.label}>Saturation</Text>
                        <GradientSlider
                            colors={satGradient}
                            value={hsl.s / 100}
                            onChange={handleSatChange}
                        />
                    </View>

                    <View style={styles.sliderContainer}>
                        <Text style={styles.label}>Lightness</Text>
                        <GradientSlider
                            colors={lightGradient}
                            value={hsl.l / 100}
                            onChange={handleLightChange}
                        />
                    </View>

                    <AppButton
                        title="Select Color"
                        variant="primary"
                        size="lg"
                        onPress={handleSave}
                    />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    container: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: Colors.surfaceHighlight,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text.primary,
    },
    previewContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        gap: 12,
    },
    preview: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: '#e2e8f0',
    },
    hexInput: {
        flex: 1,
        height: 48,
        backgroundColor: Colors.background,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.surfaceHighlight,
        color: Colors.text.primary,
        paddingHorizontal: 16,
        fontSize: 16,
        fontFamily: 'monospace',
    },
    sliderContainer: {
        marginBottom: 20,
    },
    label: {
        color: Colors.text.tertiary,
        fontSize: 12,
        marginBottom: 8,
        fontWeight: '600',
    },
    saveButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
    },
    saveButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
