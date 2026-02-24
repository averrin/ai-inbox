import React from 'react';
import { View, Text } from 'react-native';
import { Chip, ChipProps } from './Chip';
import { useSettingsStore } from '../../store/settings';
import { Colors } from './design-tokens';
import dayjs from 'dayjs';

// Extend ChipProps but make label optional because it can be derived from config
export interface MetadataChipProps extends Omit<ChipProps, 'label'> {
    label?: string | React.ReactNode;
    type?: 'tag' | 'property';
    name?: string; // The tag name or property key
    value?: string; // The property value (for properties)
}

export function MetadataChip(props: MetadataChipProps) {
    const {
        type,
        name,
        value,
        label,
        color,
        variant,
        icon,
        rounding,
        style,
        ...rest
    } = props;

    const { tagConfig, propertyConfig } = useSettingsStore();

    // If type or name is missing, behave like a dumb Chip
    if (!type || !name) {
        if (!label) return null; // Should have at least a label in dumb mode
        return (
            <Chip
                label={label}
                color={color}
                variant={variant}
                icon={icon}
                rounding={rounding}
                style={style}
                {...rest}
            />
        );
    }

    // Smart Mode Logic
    let config;
    if (type === 'tag') {
        config = tagConfig[name];
    } else {
        config = propertyConfig[name];
    }

    // 1. Check Visibility
    if (config?.hidden) {
        return null;
    }

    // 2. Determine Styling
    let activeColor = color || config?.color;
    let activeVariant = variant || config?.variant || 'default';
    let activeIcon = icon || config?.icon;
    let activeRounding = rounding || config?.rounding;
    let customStyle = style;

    // Property-specific value overrides
    if (type === 'property' && value) {
        const valStr = String(value);
        const valueConfig = config?.valueConfigs?.[valStr];

        if (valueConfig?.color) activeColor = valueConfig.color;

        // Date Logic (isPassed)
        if (config?.type === 'date') {
            const isPassed = dayjs(valStr).isValid() && dayjs(valStr).isBefore(dayjs(), 'day');
            if (isPassed) {
                // Change solid to outline if passed
                if (activeVariant === 'solid') activeVariant = 'outline';
                // Add dashed border style
                customStyle = [style, { borderStyle: 'dashed' }];
            }
        }
    }

    // Tag-specific styling default
    if (type === 'tag' && !activeColor) {
        // Default style for tags without color
        customStyle = [style, { borderColor: Colors.primary, backgroundColor: Colors.surfaceHighlight }];
    }

    // 3. Determine Label
    let displayLabel = label;

    if (!displayLabel) {
        if (type === 'tag') {
            displayLabel = config?.rewrite || `${name}`;
        } else {
            // Property
            const valStr = value ? String(value) : '';
            const displayValue = (name === 'date' && valStr === dayjs().format('YYYY-MM-DD')) ? 'Today' : valStr;

            // Determine text colors for the composite label
            const isSolid = activeVariant === 'solid';
            const isOutline = activeVariant === 'outline';
            let textColorStyle: any = undefined;

            if (isSolid) {
                textColorStyle = { color: '#FFFFFF' };
            } else if (activeColor) {
                // If colored and not solid, text takes color
                textColorStyle = { color: activeColor };
            }

            if (activeIcon) {
                // If icon exists, only show value
                 displayLabel = (
                    <Text className="text-text-primary text-[10px]" style={textColorStyle}>{displayValue}</Text>
                 );
            } else {
                // Show "Key: Value" or "RewrittenKey: Value"
                displayLabel = (
                    <>
                        <Text className="text-text-tertiary text-[10px] mr-1" style={textColorStyle}>{config?.rewrite || name}:</Text>
                        <Text className="text-text-primary text-[10px]" style={textColorStyle}>{displayValue}</Text>
                    </>
                );
            }
        }
    }

    return (
        <Chip
            label={displayLabel}
            color={activeColor}
            variant={activeVariant}
            icon={activeIcon}
            rounding={activeRounding}
            style={customStyle}
            {...rest}
        />
    );
}
