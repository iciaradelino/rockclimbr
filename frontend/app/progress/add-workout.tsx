import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, FlatList, ActivityIndicator, Modal, Platform } from 'react-native';
import React, { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { api, Workout, Climb as ApiClimb, Gym } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import _ from 'lodash';

interface ClimbEntry {
  id: string;
  grade: string;
  count: number;
  isNewClimb: boolean;
}

const DIFFICULTY_COLORS = {
  'Green (V0)': '#4E6E5D',    // Accent Green
  'Yellow (V2)': '#D4AC0D',   // Golden/Mustard Yellow
  'Blue (V4)': '#5499C7',    // Softer Blue
  'Red (V6)': '#C0392B',     // Terracotta Red
  'Black (V4)': '#212121',    // Black (Unchanged)
  'Purple (V5)': '#8E44AD',   // Softer Purple
};

export default function AddTodaysWorkoutScreen() {
  const { token } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [duration, setDuration] = useState<number>(90);
  const [climbs, setClimbs] = useState<ClimbEntry[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [sessionFeeling, setSessionFeeling] = useState<number | null>(null);
  const [achievement, setAchievement] = useState('');
  const [showGradeSelector, setShowGradeSelector] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // --- Gym Search State ---
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
  const [gymInput, setGymInput] = useState('');
  const [searchResults, setSearchResults] = useState<Gym[]>([]);
  const [isSearchingGyms, setIsSearchingGyms] = useState(false);
  const [isAddGymModalVisible, setIsAddGymModalVisible] = useState(false);
  const [newGymName, setNewGymName] = useState('');
  const [newGymLocation, setNewGymLocation] = useState('');
  const [newGymFranchise, setNewGymFranchise] = useState('');
  const [isAddingGym, setIsAddingGym] = useState(false); // Separate loading for adding gym
  // ----------------------

  // --- Date Picker Handler ---
  const onDateChange = (event: DateTimePickerEvent, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios'); // Keep open on iOS until dismissal
    if (date) {
        setSelectedDate(date);
    }
    // On Android, the picker closes automatically after selection
    if (Platform.OS === 'android') {
        setShowDatePicker(false);
    }
  };

  const showDatepicker = () => {
    setShowDatePicker(true);
  };

  // Format date for display
  const formattedDate = selectedDate.toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  // --------------------------

  const addClimb = (grade: string) => {
    // Always add a new climb entry, no grouping here
    setClimbs(prevClimbs => [...prevClimbs, {
      id: Math.random().toString(),
      grade,
      count: 1, // Count is always 1 for individual entries
      isNewClimb: false
    }]);
    setShowGradeSelector(false);
    resetForm();
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
    if (!selectedGym || duration <= 0 || climbs.length === 0) {
      Alert.alert('Error', 'Please select a Location, set a Duration (> 0 minutes), and add at least one climb.');
      return;
    }

    setIsSaving(true);
    try {
      // Group climbs by grade and count them for the API
      const groupedClimbs = _.groupBy(climbs, 'grade');
      const formattedClimbs: Omit<ApiClimb, 'notes'>[] = Object.entries(groupedClimbs).map(([grade, entries]) => ({
        route_name: `Climb ${grade}`,
        grade: grade,
        attempts: entries.length, // Count the number of entries for this grade
        send_status: 'sent', // Assuming all added climbs are 'sent' for now
      }));

      const feelingString = sessionFeeling ? sessionFeeling.toString() : undefined;

      const workout: Omit<Workout, '_id' | 'user_id' | 'created_at'> = {
        date: selectedDate.toISOString(),
        duration: duration,
        location: selectedGym.name,
        climbs: formattedClimbs,
        session_feeling: feelingString,
        achievement: achievement || undefined,
        images: images || []
      };

      console.log('Sending workout data:', JSON.stringify(workout, null, 2));
      if (!token) {
        throw new Error('Not authenticated');
      }
      const response = await api.addWorkout(token, workout);
      console.log('Server response:', response);
      
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

  // Helper function to reset state (add gym state reset)
  const resetForm = () => {
    setSelectedDate(new Date());
    setDuration(90);
    setClimbs([]);
    setImages([]);
    setSessionFeeling(null);
    setAchievement('');
    setShowGradeSelector(false);
    setIsSaving(false);
    // Reset gym state
    setSelectedGym(null);
    setGymInput('');
    setSearchResults([]);
    setIsSearchingGyms(false);
    setIsAddGymModalVisible(false);
    setNewGymName('');
    setNewGymLocation('');
    setNewGymFranchise('');
    setIsAddingGym(false);
  };

  // --- Gym Search Logic (Copied/Adapted from post.tsx) ---
  const handleSearchGyms = async (query: string) => {
    console.log(`[workout.tsx] handleSearchGyms called with query: '${query}'`);
    if (!token || query.length < 1) { 
        setSearchResults([]);
        setIsSearchingGyms(false);
        return;
    }
    setIsSearchingGyms(true);
    try {
        const results = await api.searchGyms(token, query);
        console.log('[workout.tsx] api.searchGyms response:', results);
        // Filter out already selected gym
        const filteredResults = results.filter((g: any) => g._id !== selectedGym?.id); 
        console.log('[workout.tsx] Filtered results BEFORE setting state:', JSON.stringify(filteredResults));
        setSearchResults(filteredResults as Gym[]);
    } catch (error) {
        console.error("[workout.tsx] Error searching gyms:", error);
        setSearchResults([]);
    } finally {
        setIsSearchingGyms(false);
    }
  };

  const debouncedSearch = useCallback(
      _.debounce(handleSearchGyms, 300),
      [token, selectedGym]
  );

  useEffect(() => {
      debouncedSearch(gymInput);
      return () => {
          debouncedSearch.cancel();
      };
  }, [gymInput, debouncedSearch]);

  // --- Gym Selection Handlers ---
  const handleSelectGym = (gym: Gym | any) => { // Allow any temporarily for _id access
    // Ensure we create a Gym object with 'id'
    const gymToSelect: Gym = {
        id: gym._id || gym.id,
        name: gym.name,
        location: gym.location,
        franchise: gym.franchise
    };
    setSelectedGym(gymToSelect);
    setGymInput(''); 
    setSearchResults([]); 
  };

  const handleRemoveSelectedGym = () => {
    setSelectedGym(null);
    // Optionally focus the input again here
  };

  // --- Add New Gym Modal Handlers ---
  const handleAddNewGym = () => {
    if (!gymInput.trim()) return;
    setNewGymName(gymInput.trim());
    setNewGymLocation(''); 
    setNewGymFranchise('');
    setIsAddGymModalVisible(true);
  };

  const handleSubmitNewGymDetails = async () => {
    if (!token || !newGymName || !newGymLocation) {
        Alert.alert("Missing Information", "Please provide both a name and location for the gym.");
        return;
    }
    setIsAddingGym(true); 
    try {
        const addedGym = await api.addGym(token, {
            name: newGymName,
            location: newGymLocation,
            franchise: newGymFranchise || undefined,
        });
        // Pass the raw addedGym object which might have _id
        handleSelectGym(addedGym); 
        setIsAddGymModalVisible(false); 
    } catch (error: any) {
        console.error("Error adding new gym via modal:", error);
        Alert.alert("Error", error.message || "Failed to add gym.");
    } finally {
        setIsAddingGym(false);
    }
  };

  const handleCancelAddGym = () => {
    setIsAddGymModalVisible(false);
    setNewGymName('');
    setNewGymLocation('');
    setNewGymFranchise('');
  };
  // ---------------------------------------------------------

  // --- Duration Handlers ---
  const incrementDuration = () => {
    setDuration(prev => prev + 15);
  };

  const decrementDuration = () => {
    setDuration(prev => Math.max(0, prev - 15)); // Prevent going below 0
  };
  // -----------------------

  return (
    <ScrollView style={styles.container}>
      {/* Date Section */}
      <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date</Text>
          <TouchableOpacity onPress={showDatepicker} style={styles.dateInputTouchable}>
              <Text style={styles.dateText}>{formattedDate}</Text>
              <Ionicons name="calendar-outline" size={24} color="#666" />
          </TouchableOpacity>
          {showDatePicker && (
              <DateTimePicker
                  testID="dateTimePicker"
                  value={selectedDate}
                  mode="date"
                  display="default" // Or "spinner" or "calendar" etc.
                  onChange={onDateChange}
              />
          )}
      </View>

      {/* Location Section - Updated */}
      <View style={styles.section}> 
        <Text style={styles.sectionTitle}>Location</Text>
        {selectedGym ? (
          // Display selected gym tag 
          <View style={styles.tag}> 
            <Text style={styles.tagText}>{selectedGym.name}</Text> 
            <TouchableOpacity onPress={handleRemoveSelectedGym} style={styles.removeTagButton}> 
              <Ionicons name="close-circle" size={18} color="#666" /> 
            </TouchableOpacity> 
          </View> 
        ) : (
          // Show search input if no gym is selected 
          <React.Fragment> 
            <TextInput 
              style={styles.input} // Use existing input style
              value={gymInput} 
              onChangeText={setGymInput} 
              placeholder="Where did you climb?" 
              placeholderTextColor="#999" 
            /> 

            {/* Search Results List */} 
            {isSearchingGyms && <ActivityIndicator style={styles.searchIndicator} size="small" color="#4E6E5D" />} 
            {searchResults.length > 0 && ( 
              <FlatList 
                style={styles.resultsList} 
                data={searchResults} 
                keyExtractor={(item: any) => `gym-${item._id || item.name}`} 
                renderItem={({ item }) => ( 
                  <TouchableOpacity 
                    style={styles.resultItem} 
                    onPress={() => handleSelectGym(item)} 
                  > 
                    <Text style={styles.resultText}>{item.name}</Text> 
                  </TouchableOpacity> 
                )} 
                keyboardShouldPersistTaps="always" 
              /> 
            )} 

            {/* Add New Gym Button (Calculate isExactMatchInSearch) */}
            {(() => { // IIFE to calculate isExactMatchInSearch inline
              const isExactMatchInSearch = searchResults.some(
                (result) => result.name.toLowerCase() === gymInput.trim().toLowerCase()
              );
              return gymInput.trim().length > 0 && !isSearchingGyms && !isExactMatchInSearch && (
                <TouchableOpacity style={styles.addNewButton} onPress={handleAddNewGym}> 
                  <Ionicons name="add-circle-outline" size={18} color="#4E6E5D" style={{ marginRight: 5 }}/> 
                  <Text style={styles.addNewButtonText}>Add "{gymInput.trim()}"</Text> 
                </TouchableOpacity> 
              );
            })()} 
          </React.Fragment> 
        )} 
      </View>

      {/* Duration Section - Updated */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Duration</Text>
        <View style={styles.durationControl}>
          <TouchableOpacity onPress={decrementDuration} style={styles.durationButton}>
            <Ionicons name="remove-circle-outline" size={30} color="#4E6E5D" />
          </TouchableOpacity>
          <Text style={styles.durationText}>{duration} min</Text>
          <TouchableOpacity onPress={incrementDuration} style={styles.durationButton}>
            <Ionicons name="add-circle-outline" size={30} color="#4E6E5D" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Climbs Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Climbs</Text>
        {climbs.map(climb => (
          <View key={climb.id} style={styles.climbEntry}>
            <View style={styles.climbInfo}>
              <View style={[styles.gradeDot, { backgroundColor: DIFFICULTY_COLORS[climb.grade as keyof typeof DIFFICULTY_COLORS] }]} />
              <Text style={styles.climbGrade}>{climb.grade}</Text>
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

      {/* --- Add Gym Modal --- */}
      <Modal
          animationType="slide"
          transparent={true}
          visible={isAddGymModalVisible}
          onRequestClose={handleCancelAddGym}
      >
          <View style={styles.modalOverlay}> 
              <View style={styles.modalContainer}> 
                  <Text style={styles.modalTitle}>Add New Gym Details</Text>

                  <Text style={styles.modalLabel}>Gym Name</Text>
                  <TextInput
                      style={[styles.input, styles.modalInput]} // Use existing input style
                      value={newGymName}
                      onChangeText={setNewGymName}
                      placeholder="Gym Name"
                      placeholderTextColor="#999"
                  />

                  <Text style={styles.modalLabel}>Location</Text>
                  <TextInput
                      style={[styles.input, styles.modalInput]}
                      value={newGymLocation}
                      onChangeText={setNewGymLocation}
                      placeholder="Enter gym address or city"
                      placeholderTextColor="#999"
                  />

                  <Text style={styles.modalLabel}>Franchise (Optional)</Text>
                  <TextInput
                      style={[styles.input, styles.modalInput]}
                      value={newGymFranchise}
                      onChangeText={setNewGymFranchise}
                      placeholder="e.g., Movement, Planet Granite"
                      placeholderTextColor="#999"
                  />

                  <View style={styles.modalButtonContainer}>
                      <TouchableOpacity
                          style={[styles.modalButton, styles.cancelButton]}
                          onPress={handleCancelAddGym}
                          disabled={isAddingGym}
                      >
                          <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                          style={[styles.modalButton, styles.submitButton, isAddingGym && styles.buttonDisabled]}
                          onPress={handleSubmitNewGymDetails}
                          disabled={isAddingGym}
                      >
                          {isAddingGym ? (
                              <ActivityIndicator color="#FFF" size="small" />
                          ) : (
                              <Text style={styles.modalButtonText}>Add Gym</Text>
                          )}
                      </TouchableOpacity>
                  </View>
              </View>
          </View>
      </Modal>
      {/* --------------------- */}

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
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'space-between',
    alignSelf: 'flex-start',
    minWidth: '60%',
  },
  tagText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: '#333',
    marginRight: 8,
    flexShrink: 1,
  },
  removeTagButton: {
    padding: 2,
  },
  searchIndicator: {
    marginTop: 8,
    alignSelf: 'center',
  },
  resultsList: {
    maxHeight: 150,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 8,
    marginTop: 5,
    backgroundColor: 'white',
  },
  resultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  resultText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
  },
  addNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  addNewButtonText: {
    fontFamily: 'Inter_500Medium',
    color: '#4E6E5D',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 25,
    alignItems: 'stretch',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  modalLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#555',
    marginBottom: 6,
    marginTop: 10,
  },
  modalInput: {
    marginBottom: 15,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 25,
  },
  modalButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  submitButton: {
    backgroundColor: '#4E6E5D',
  },
  modalButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: '#fff',
  },
  cancelButtonText: {
    color: '#555',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  // New Duration Styles
  durationControl: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 0,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 8,
  },
  durationText: {
    fontSize: 18,
    fontFamily: 'Inter_400Regular',
    color: '#1c1c1e',
    minWidth: 80, // Ensure space for text like "120 min"
    textAlign: 'center',
  },
  durationButton: {
    padding: 8, // Add padding for easier tapping
  },
  // New Date Styles
  dateInputTouchable: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 8,
    padding: 12,
    // Mimic input style height/padding
  },
  dateText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#1c1c1e',
  },
  // End New Date Styles
}); 