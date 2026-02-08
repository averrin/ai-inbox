import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { DumpEditor } from '../DumpEditor';
import { useDumpFile } from '../../hooks/useDumpFile';

const DumpScreen = () => {
  const { content, onContentChange, isLoading } = useDumpFile();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <DumpEditor 
          value={content}
          onChange={onContentChange}
          isLoading={isLoading}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // slate-900
  },
  content: {
    flex: 1,
    padding: 16,
  },
});

export default DumpScreen;
