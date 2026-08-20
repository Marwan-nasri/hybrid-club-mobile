import { ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
};

export function Sheet({ visible, onClose, children, title }: SheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-background/80" onPress={onClose} />
      <View className="rounded-t-sheet bg-surface-elevated px-5 pb-8 pt-3">
        <View className="mb-4 h-1 w-10 self-center rounded-pill bg-border" />
        {title ? (
          <Text className="mb-4 text-xl font-semibold text-text-primary">{title}</Text>
        ) : null}
        {children}
      </View>
    </Modal>
  );
}
