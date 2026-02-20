import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './design-tokens';

interface JsonTreeItemProps {
  label?: string;
  value: any;
  level?: number;
  path?: string[];
  onEdit?: (path: string[], value: any) => void;
  onDelete?: (path: string[]) => void;
}

const INDENT_SIZE = 16;

const JsonTreeItem: React.FC<JsonTreeItemProps> = ({
  label,
  value,
  level = 0,
  path = [],
  onEdit,
  onDelete
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const { type, displayValue, isExpandable, parsedValue } = useMemo(() => {
    let type = typeof value;
    let displayValue: any = value;
    let isExpandable = false;
    let parsedValue: any = null;

    if (value === null) {
      type = 'null';
      displayValue = 'null';
    } else if (Array.isArray(value)) {
      type = 'array';
      displayValue = `Array(${value.length})`;
      isExpandable = value.length > 0;
    } else if (type === 'object') {
      displayValue = '{...}';
      isExpandable = Object.keys(value).length > 0;
    } else if (type === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object') {
            parsedValue = parsed;
            isExpandable = true;
            // Show preview of the parsed object/array
            if (Array.isArray(parsed)) {
                displayValue = `"${value.substring(0, 20)}..." (JSON Array)`;
            } else {
                displayValue = `"${value.substring(0, 20)}..." (JSON Object)`;
            }
        } else {
            displayValue = `"${value}"`;
        }
      } catch (e) {
        displayValue = `"${value}"`;
      }
    } else {
      displayValue = String(value);
    }

    return { type, displayValue, isExpandable, parsedValue };
  }, [value]);

  const toggleExpand = () => setIsExpanded(!isExpanded);

  const renderChildren = () => {
    if (!isExpandable) return null;

    const target = parsedValue || value;

    if (Array.isArray(target)) {
      return target.map((item, index) => (
        <JsonTreeItem
            key={index}
            label={String(index)}
            value={item}
            level={level + 1}
            path={[...path, String(index)]}
            onEdit={onEdit}
            onDelete={onDelete}
        />
      ));
    }

    return Object.entries(target).map(([key, val]) => (
      <JsonTreeItem
        key={key}
        label={key}
        value={val}
        level={level + 1}
        path={[...path, key]}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    ));
  };

  const getColor = () => {
    if (parsedValue) return 'text-purple-400'; // Special color for parsed JSON strings
    switch (type) {
      case 'string': return 'text-green-400';
      case 'number': return 'text-blue-400';
      case 'boolean': return 'text-yellow-400';
      case 'null': return 'text-gray-500';
      case 'undefined': return 'text-gray-500';
      case 'object': return 'text-slate-300';
      case 'array': return 'text-slate-300';
      default: return 'text-white';
    }
  };

  return (
    <View className="mb-1">
      <View className="flex-row items-center justify-between group">
        <TouchableOpacity
            onPress={isExpandable ? toggleExpand : undefined}
            activeOpacity={isExpandable ? 0.7 : 1}
            className="flex-row items-start flex-1"
            style={{ paddingLeft: level * INDENT_SIZE }}
        >
            <View className="w-6 items-center justify-center pt-0.5">
            {isExpandable && (
                <Ionicons
                name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                size={14}
                color={Colors.text.tertiary}
                />
            )}
            </View>

            <Text className="text-xs font-mono flex-wrap flex-1 text-slate-300 pr-2">
            {label && <Text className="font-bold text-indigo-300">{label}: </Text>}
            <Text className={getColor()}>{String(displayValue)}</Text>
            </Text>
        </TouchableOpacity>

        {(onEdit || onDelete) && (
            <View className="flex-row items-center space-x-2 mr-2 opacity-50">
                {onEdit && (
                    <TouchableOpacity onPress={() => onEdit(path, value)} className="p-1">
                        <Ionicons name="pencil" size={12} color={Colors.text.tertiary} />
                    </TouchableOpacity>
                )}
                {onDelete && (
                    <TouchableOpacity onPress={() => onDelete(path)} className="p-1">
                        <Ionicons name="trash" size={12} color={Colors.error} />
                    </TouchableOpacity>
                )}
            </View>
        )}
      </View>

      {isExpanded && (
        <View>
          {renderChildren()}
        </View>
      )}
    </View>
  );
};

export const JsonTreeView: React.FC<{
    data: any;
    onEdit?: (path: string[], value: any) => void;
    onDelete?: (path: string[]) => void;
}> = ({ data, onEdit, onDelete }) => {
  return (
    <View className="p-2 bg-slate-900 rounded-lg border border-slate-700 min-h-[200px]">
      <JsonTreeItem value={data} onEdit={onEdit} onDelete={onDelete} />
    </View>
  );
};
