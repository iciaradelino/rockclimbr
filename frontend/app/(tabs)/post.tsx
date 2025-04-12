import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, ScrollView, Modal, Alert } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import LocationAutocomplete from '../../components/LocationAutocomplete';

const CLIMBING_GRADES = {
  'Sport/Top Rope': [
    '5.6', '5.7', '5.8', '5.9',
    '5.10a', '5.10b', '5.10c', '5.10d',
    '5.11a', '5.11b', '5.11c', '5.11d',
    '5.12a', '5.12b', '5.12c', '5.12d',
  ],
  'Boulder': [
    'V0', 'V1', 'V2', 'V3', 'V4',
    'V5', 'V6', 'V7', 'V8', 'V9',
  ]
};

export default function CreatePostScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [showGradeSelector, setShowGradeSelector] = useState(false);
  const [selectedGradeType, setSelectedGradeType] = useState<'Sport/Top Rope' | 'Boulder'>('Sport/Top Rope');
  const [isSaving, setIsSaving] = useState(false);
  const { token } = useAuth();

  const resetForm = () => {
    setImage(null);
    setCaption('');
    setLocation('');
    setDifficulty('');
    setShowGradeSelector(false);
    setSelectedGradeType('Sport/Top Rope');
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const createPost = async () => {
    if (!image || !caption || !location || !difficulty) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }

    if (!token) {
      Alert.alert('Error', 'You need to be logged in to create a post.');
      return;
    }

    setIsSaving(true);
    try {
      const post = {
        image_url: image,
        caption,
        location,
        difficulty,
        timestamp: new Date().toISOString()
      };

      console.log('Creating post:', post); // Debug log
      
      const response = await api.addPost(token, post);
      console.log('Server response:', response); // Debug log
      
      Alert.alert('Success', 'Post created successfully!');
      resetForm(); // Reset the form fields
      router.push('/(tabs)/profile');
    } catch (error: any) {
      console.error('Error creating post:', error);
      Alert.alert(
        'Error', 
        error.response?.error || 'Failed to create post. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={{ position: 'relative' }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Image Selection */}
      <TouchableOpacity style={styles.imageContainer} onPress={pickImage}>
        {image ? (
          <Image source={{ uri: image }} style={styles.selectedImage} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="camera" size={40} color="#666" />
            <Text style={styles.imagePlaceholderText}>Tap to add photo</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Caption Input */}
      <View style={styles.section}>
        <TextInput
          style={styles.captionInput}
          placeholder="Write a caption..."
          value={caption}
          onChangeText={setCaption}
          multiline
          placeholderTextColor="#666"
        />
      </View>

      {/* Location Input */}
      <View style={[styles.section, { zIndex: 1000 }]}>
        <LocationAutocomplete
          value={location}
          onLocationSelect={setLocation}
          placeholder="Add climbing location"
          inputStyle={styles.locationInput}
        />
      </View>

      {/* Difficulty Grade Input - lower zIndex so location suggestions can overlay */}
      <View style={[styles.section, { zIndex: 10 }]}>
        <TouchableOpacity 
          style={styles.gradeButton}
          onPress={() => setShowGradeSelector(true)}
        >
          <Ionicons name="stats-chart-outline" size={20} color="#666" />
          <Text style={[styles.gradeButtonText, difficulty ? styles.gradeSelected : styles.gradePlaceholder]}>
            {difficulty || "Add difficulty grade"}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Grade Selector Modal */}
      <Modal
        visible={showGradeSelector}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGradeSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Grade</Text>
              <TouchableOpacity onPress={() => setShowGradeSelector(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.gradeTypeSelector}>
              {Object.keys(CLIMBING_GRADES).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.gradeTypeButton,
                    selectedGradeType === type && styles.gradeTypeButtonActive
                  ]}
                  onPress={() => setSelectedGradeType(type as 'Sport/Top Rope' | 'Boulder')}
                >
                  <Text style={[
                    styles.gradeTypeText,
                    selectedGradeType === type && styles.gradeTypeTextActive
                  ]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView style={styles.gradeList}>
              {CLIMBING_GRADES[selectedGradeType].map((grade) => (
                <TouchableOpacity
                  key={grade}
                  style={[
                    styles.gradeOption,
                    difficulty === grade && styles.gradeOptionSelected
                  ]}
                  onPress={() => {
                    setDifficulty(grade);
                    setShowGradeSelector(false);
                  }}
                >
                  <Text style={[
                    styles.gradeOptionText,
                    difficulty === grade && styles.gradeOptionTextSelected
                  ]}>
                    {grade}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Share Button */}
      <TouchableOpacity 
        style={[
          styles.shareButton, 
          (!image || !caption || !location || !difficulty || isSaving) && styles.shareButtonDisabled
        ]}
        onPress={createPost}
        disabled={!image || !caption || !location || !difficulty || isSaving}
      >
        <Text style={styles.shareButtonText}>
          {isSaving ? 'Creating...' : 'Share'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  imageContainer: {
    width: '100%',
    height: 400,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    alignItems: 'center',
  },
  imagePlaceholderText: {
    marginTop: 8,
    color: '#666',
    fontFamily: 'Inter_500Medium',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
    marginBottom: 8,
    zIndex: 100,
  },
  captionInput: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  locationInput: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  gradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  gradeButtonText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  gradePlaceholder: {
    color: '#666',
  },
  gradeSelected: {
    color: '#000',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  gradeTypeSelector: {
    flexDirection: 'row',
    padding: 8,
    gap: 8,
  },
  gradeTypeButton: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  gradeTypeButtonActive: {
    backgroundColor: '#4E6E5D',
  },
  gradeTypeText: {
    fontFamily: 'Inter_500Medium',
    color: '#666',
  },
  gradeTypeTextActive: {
    color: '#fff',
  },
  gradeList: {
    padding: 16,
  },
  gradeOption: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
  },
  gradeOptionSelected: {
    backgroundColor: '#4E6E5D',
  },
  gradeOptionText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    color: '#000',
  },
  gradeOptionTextSelected: {
    color: '#fff',
  },
  shareButton: {
    backgroundColor: '#4E6E5D',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareButtonDisabled: {
    backgroundColor: '#91AB9D',
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
}); 