import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api, Workout, Climb as ApiClimb } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

interface ClimbEntry {
  id: string;
  grade: string;
  count: number;
  isNewClimb: boolean;
}

const DIFFICULTY_COLORS = {
  'Blue (V0-V1)': '#3498db',
  'Red (V2-V3)': '#4E6E5D',
  'Black (V4-V5)': '#2c3e50',
  'Purple (V6+)': '#9b59b6',
};

export default function AddTodaysWorkoutScreen() {
  const { token } = useAuth();
  const [duration, setDuration] = useState('');
  const [climbs, setClimbs] = useState<ClimbEntry[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [sessionFeeling, setSessionFeeling] = useState<number | null>(null);
  const [achievement, setAchievement] = useState('');
  const [showGradeSelector, setShowGradeSelector] = useState(false);
  const [location, setLocation] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const addClimb = (grade: string) => {
    const existingClimb = climbs.find(c => c.grade === grade);
    if (existingClimb) {
      setClimbs(climbs.map(c => 
        c.grade === grade 
          ? { ...c, count: c.count + 1 }
          : c
      ));
    } else {
      setClimbs([...climbs, {
        id: Math.random().toString(),
        grade,
        count: 1,
        isNewClimb: false
      }]);
    }
    setShowGradeSelector(false);
  };

  const toggleNewClimb = (id: string) => {
    setClimbs(climbs.map(c => 
      c.id === id 
        ? { ...c, isNewClimb: !c.isNewClimb }
        : c
    ));
  };

  const removeClimb = (id: string) => {
    setClimbs(climbs.filter(c => c.id !== id));
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets[0].uri) {
      setImages([...images, result.assets[0].uri]);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const saveWorkout = async () => {
    if (!duration || !location || climbs.length === 0) {
      Alert.alert('Error', 'Please fill in all required fields (Location, Duration in minutes) and add at least one climb.');
      return;
    }

    // Attempt to parse duration as integer (minutes)
    const durationMinutes = parseInt(duration, 10);
    if (isNaN(durationMinutes) || durationMinutes <= 0) {
      Alert.alert('Error', 'Please enter a valid duration in minutes (e.g., 120).');
      return;
    }

    setIsSaving(true);
    try {
      // Convert climbs to the format expected by the API (ApiClimb)
      const formattedClimbs: Omit<ApiClimb, 'notes'>[] = climbs.map(climb => ({
        route_name: `Climb ${climb.grade}`, // Renamed from name
        grade: climb.grade,
        attempts: climb.count, // Use count for attempts
        send_status: 'sent', // Added default send_status
        // 'style' and 'is_new' are removed as they are not in the backend model
      }));

      // Convert session_feeling to string or undefined
      const feelingString = sessionFeeling ? sessionFeeling.toString() : undefined;

      const workout: Omit<Workout, '_id' | 'user_id' | 'created_at'> = {
        date: new Date().toISOString(),
        duration: durationMinutes, // Use parsed integer
        location,
        climbs: formattedClimbs,
        session_feeling: feelingString, // Use string version
        achievement: achievement || undefined,
        images: images || [] // Ensure images is always an array
      };

      console.log('Sending workout data:', JSON.stringify(workout, null, 2)); // Improved debug log
      if (!token) {
        throw new Error('Not authenticated');
      }
      const response = await api.addWorkout(token, workout);
      console.log('Server response:', response); // Debug log
      
      Alert.alert('Success', 'Workout saved successfully!');
      router.back();
    } catch (error: any) {
      console.error('Error saving workout:', error);
      Alert.alert(
        'Error', 
        error.response?.data?.error || 'Failed to save workout. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Location Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        <TextInput
          style={styles.input}
          placeholder="Where did you climb?"
          value={location}
          onChangeText={setLocation}
          placeholderTextColor="#666"
        />
      </View>

      {/* Duration Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Duration</Text>
        <TextInput
          style={styles.input}
          placeholder="How long did you climb? (e.g., 2 hours)"
          value={duration}
          onChangeText={setDuration}
          placeholderTextColor="#666"
        />
      </View>

      {/* Climbs Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Climbs</Text>
        {climbs.map(climb => (
          <View key={climb.id} style={styles.climbEntry}>
            <View style={styles.climbInfo}>
              <View style={[styles.gradeDot, { backgroundColor: DIFFICULTY_COLORS[climb.grade as keyof typeof DIFFICULTY_COLORS] }]} />
              <Text style={styles.climbGrade}>{climb.grade}</Text>
              <Text style={styles.climbCount}>×{climb.count}</Text>
            </View>
            <View style={styles.climbActions}>
              <TouchableOpacity 
                style={[styles.newClimbButton, climb.isNewClimb && styles.newClimbButtonActive]}
                onPress={() => toggleNewClimb(climb.id)}
              >
                <Text style={[styles.newClimbText, climb.isNewClimb && styles.newClimbTextActive]}>
                  New Climb
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeClimb(climb.id)}>
                <Ionicons name="close-circle" size={24} color="#666" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowGradeSelector(!showGradeSelector)}
        >
          <Text style={styles.addButtonText}>+ Add Climb</Text>
        </TouchableOpacity>

        {showGradeSelector && (
          <View style={styles.gradeSelector}>
            {Object.entries(DIFFICULTY_COLORS).map(([grade, color]) => (
              <TouchableOpacity
                key={grade}
                style={[styles.gradeOption, { backgroundColor: color }]}
                onPress={() => addClimb(grade)}
              >
                <Text style={styles.gradeOptionText}>{grade}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Pictures Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pictures</Text>
        <View style={styles.imageGrid}>
          {images.map((uri, index) => (
            <View key={index} style={styles.imageContainer}>
              <Image source={{ uri }} style={styles.image} />
              <TouchableOpacity 
                style={styles.removeImage}
                onPress={() => removeImage(index)}
              >
                <Ionicons name="close-circle" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
            <Ionicons name="camera" size={32} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Session Feeling */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How was your session?</Text>
        <View style={styles.feelingRow}>
          {[1, 2, 3, 4, 5].map((rating) => (
            <TouchableOpacity
              key={rating}
              onPress={() => setSessionFeeling(rating)}
              style={styles.feelingButton}
            >
              <Ionicons
                name={sessionFeeling !== null && sessionFeeling >= rating ? 'star' : 'star-outline'}
                size={32}
                color={sessionFeeling !== null && sessionFeeling >= rating ? '#4E6E5D' : '#666'}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Achievement */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Share an achievement</Text>
        <TextInput
          style={[styles.input, styles.achievementInput]}
          placeholder="What did you accomplish today?"
          value={achievement}
          onChangeText={setAchievement}
          multiline
          placeholderTextColor="#666"
        />
      </View>

      {/* Save Button */}
      <TouchableOpacity 
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        onPress={saveWorkout}
        disabled={isSaving}
      >
        <Text style={styles.saveButtonText}>
          {isSaving ? 'Saving...' : 'Save Workout'}
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
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 12,
    color: '#1c1c1e',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  achievementInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  addButton: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: {
    color: '#666',
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
  },
  climbEntry: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  climbInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  gradeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  climbGrade: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    marginRight: 8,
  },
  climbCount: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#666',
  },
  climbActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newClimbButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  newClimbButtonActive: {
    backgroundColor: '#4E6E5D',
  },
  newClimbText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#666',
  },
  newClimbTextActive: {
    color: '#fff',
  },
  gradeSelector: {
    marginTop: 8,
    gap: 8,
  },
  gradeOption: {
    padding: 12,
    borderRadius: 8,
  },
  gradeOptionText: {
    color: '#fff',
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeImage: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  feelingRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  feelingButton: {
    padding: 8,
  },
  saveButton: {
    backgroundColor: '#4E6E5D',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
}); 