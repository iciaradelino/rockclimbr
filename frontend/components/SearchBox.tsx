import { View, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type SearchBoxProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  editable?: boolean;
};

export default function SearchBox({ 
  value, 
  onChangeText, 
  placeholder = 'Search...',
  editable = true 
}: SearchBoxProps) {
  return (
    <View style={styles.container}>
      <Ionicons name="search" size={20} color="#666" style={styles.icon} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#666"
        editable={editable}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    height: 40,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#333',
  },
}); 