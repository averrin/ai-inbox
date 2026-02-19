import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface JsonTreeItemProps {
  label?: string;
  value: any;
  level?: number;
}

const INDENT_SIZE = 16;

const JsonTreeItem: React.FC<JsonTreeItemProps> = ({ label, value, level = 0 }) => {
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
        <JsonTreeItem key={index} label={String(index)} value={item} level={level + 1} />
      ));
    }

    return Object.entries(target).map(([key, val]) => (
      <JsonTreeItem key={key} label={key} value={val} level={level + 1} />
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
      <TouchableOpacity
        onPress={isExpandable ? toggleExpand : undefined}
        activeOpacity={isExpandable ? 0.7 : 1}
        className="flex-row items-start"
        style={{ paddingLeft: level * INDENT_SIZE }}
      >
        <View className="w-6 items-center justify-center pt-0.5">
          {isExpandable && (
            <Ionicons
              name={isExpanded ? 'chevron-down' : 'chevron-forward'}
              size={14}
              color="#94a3b8"
            />
          )}
        </View>

        <Text className="text-xs font-mono flex-wrap flex-1 text-slate-300">
          {label && <Text className="font-bold text-indigo-300">{label}: </Text>}
          <Text className={getColor()}>{String(displayValue)}</Text>
        </Text>
      </TouchableOpacity>

      {isExpanded && (
        <View>
          {renderChildren()}
        </View>
      )}
    </View>
  );
};

export const JsonTreeView: React.FC<{ data: any }> = ({ data }) => {
  return (
    <View className="p-2 bg-slate-900 rounded-lg border border-slate-700 min-h-[200px]">
      <JsonTreeItem value={data} />
    </View>
  );
};
