import React from 'react';
import { View } from 'react-native';
import { DumpEditor } from '../DumpEditor';
import { useDumpFile } from '../../hooks/useDumpFile';
import { Layout } from '../ui/Layout';
import { ScreenHeader } from '../ui/ScreenHeader';

const DumpScreen = () => {
  const { content, onContentChange, isLoading } = useDumpFile();

  return (
    <Layout>
      <ScreenHeader title="Dump" />
      <View className="flex-1 px-4">
        <DumpEditor 
          value={content}
          onChange={onContentChange}
          isLoading={isLoading}
        />
      </View>
    </Layout>
  );
};

export default DumpScreen;
