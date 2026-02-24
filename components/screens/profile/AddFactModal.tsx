import React from 'react';
import Toast from 'react-native-toast-message';
import { MessageDialog } from '../../ui/MessageDialog';

interface AddFactModalProps {
    visible: boolean;
    onClose: () => void;
    onAddFact: (text: string) => Promise<void>;
    isLoading: boolean;
}

export const AddFactModal: React.FC<AddFactModalProps> = ({
    visible,
    onClose,
    onAddFact,
    isLoading
}) => {
    return (
        <MessageDialog
            visible={visible}
            onClose={onClose}
            onSend={async (text) => {
                try {
                    await onAddFact(text);
                    onClose();
                    Toast.show({
                        type: 'success',
                        text1: 'Fact Added',
                        text2: 'Profile updated successfully'
                    });
                } catch (e) {
                    Toast.show({
                        type: 'error',
                        text1: 'Error',
                        text2: 'Failed to add fact'
                    });
                }
            }}
            sending={isLoading}
            title="Add New Fact"
            placeholder="Describe a new fact, preference, or trait..."
            sendLabel="Add Fact"
            enableImageAttachment={true}
            imagePrompt="Analyze this image to extract facts, habits, or preferences about the user."
        />
    );
};
