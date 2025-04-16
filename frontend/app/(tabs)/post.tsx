import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, ScrollView, Modal, Alert, FlatList, ActivityIndicator } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { api, Gym } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import LocationAutocomplete from '../../components/LocationAutocomplete';
import _ from 'lodash';

// Simplify to only Boulder grades
const BOULDER_GRADES = [
  'V0', 'V1', 'V2', 'V3', 'V4',
  'V5', 'V6', 'V7', 'V8', 'V9',
];

// Define Color grades
const COLOR_GRADES = ['Green', 'Yellow', 'Blue', 'Red', 'Black', 'Purple'];

// Define type for grading system
type GradingSystem = 'V Scale' | 'Color';

export default function CreatePostScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { token } = useAuth();

  // Add state for dropdown
  const [isGradeDropdownOpen, setIsGradeDropdownOpen] = useState(false);
  // Add state for grading system selection
  const [gradingSystem, setGradingSystem] = useState<GradingSystem>('V Scale');

  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
  const [gymInput, setGymInput] = useState('');
  const [searchResults, setSearchResults] = useState<Gym[]>([]);
  const [isSearchingGyms, setIsSearchingGyms] = useState(false);
  const [isAddGymModalVisible, setIsAddGymModalVisible] = useState(false);
  const [newGymName, setNewGymName] = useState('');
  const [newGymLocation, setNewGymLocation] = useState('');
  const [newGymFranchise, setNewGymFranchise] = useState('');
  const [isAddingGym, setIsAddingGym] = useState(false);

  const resetForm = () => {
    setImage(null);
    setCaption('');
    setDifficulty('');
    setSelectedGym(null);
    setGymInput('');
    setSearchResults([]);
    setIsSearchingGyms(false);
    setIsAddGymModalVisible(false);
    setNewGymName('');
    setNewGymLocation('');
    setNewGymFranchise('');
    setIsAddingGym(false);
    setIsGradeDropdownOpen(false);
    setGradingSystem('V Scale'); // Reset grading system
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
    if (!image || !caption || !selectedGym || !difficulty) {
      Alert.alert('Error', 'Please fill in all required fields (Photo, Caption, Gym, Grade).');
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
        gym_id: selectedGym.id,
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

  // --- Gym Search Logic ---
  const handleSearchGyms = async (query: string) => {
    console.log(`[post.tsx] handleSearchGyms called with query: '${query}'`); // Log query
    if (!token || query.length < 1) {
        setSearchResults([]);
        setIsSearchingGyms(false);
        return;
    }
    setIsSearchingGyms(true);
    try {
        console.log(`[post.tsx] Calling api.searchGyms with query: '${query}'`); // Log API call
        const results = await api.searchGyms(token, query);
        console.log('[post.tsx] api.searchGyms response:', results); // Log raw response
        
        // Filter out already selected gym if needed (using _id from response)
        const filteredResults = results.filter((g: any) => g._id !== selectedGym?.id);
        console.log('[post.tsx] Filtered results BEFORE setting state:', JSON.stringify(filteredResults)); // Log filtered results content
        console.log('[post.tsx] Setting searchResults state now...'); // Add log before setting state
        setSearchResults(filteredResults as Gym[]);
    } catch (error) {
        console.error("[post.tsx] Error searching gyms:", error);
        setSearchResults([]);
    } finally {
        setIsSearchingGyms(false);
    }
  };

  const debouncedSearch = useCallback(
      _.debounce(handleSearchGyms, 300),
      [token, selectedGym] // Recreate if token/selection changes
  );

  useEffect(() => {
      // Trigger search when gymInput changes
      debouncedSearch(gymInput);
      // Cleanup debounce timer
      return () => {
          debouncedSearch.cancel();
      };
  }, [gymInput, debouncedSearch]);
  // ----------------------

  // --- Gym Selection Handlers ---
  const handleSelectGym = (gym: Gym) => {
    setSelectedGym(gym);
    setGymInput(''); // Clear input after selection
    setSearchResults([]); // Hide results
  };

  const handleRemoveSelectedGym = () => {
    setSelectedGym(null);
  };

  // --- Add New Gym Modal Handlers ---
  const handleAddNewGym = () => {
    if (!gymInput.trim()) return;
    // Pre-fill modal with current input
    setNewGymName(gymInput.trim());
    setNewGymLocation(''); // Clear other fields
    setNewGymFranchise('');
    setIsAddGymModalVisible(true);
    // Optional: Clear search input/results immediately
    // setGymInput('');
    // setSearchResults([]);
  };

  const handleSubmitNewGymDetails = async () => {
    if (!token || !newGymName || !newGymLocation) {
        Alert.alert("Missing Information", "Please provide both a name and location for the gym.");
        return;
    }
    setIsAddingGym(true); // Show loading state
    try {
        const addedGym = await api.addGym(token, {
            name: newGymName,
            location: newGymLocation,
            franchise: newGymFranchise || undefined,
        });
        handleSelectGym(addedGym); // Select the newly added gym
        setIsAddGymModalVisible(false); // Close modal
    } catch (error: any) {
        console.error("Error adding new gym via modal:", error);
        Alert.alert("Error", error.message || "Failed to add gym.");
    } finally {
        setIsAddingGym(false);
    }
  };

  const handleCancelAddGym = () => {
    setIsAddGymModalVisible(false);
    // Clear modal fields
    setNewGymName('');
    setNewGymLocation('');
    setNewGymFranchise('');
  };
  // ---------------------------

  // Calculate if the current input exactly matches a result
  const isExactMatchInSearch = searchResults.some(
    (result) => result.name.toLowerCase() === gymInput.trim().toLowerCase()
  );

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

      {/* Location Input - Replace with Gym Input */}
      <View style={[styles.section, styles.gymSection]}> 
        <TouchableOpacity 
          style={styles.gymButton} 
          onPress={() => { /* Maybe focus input or handle tap when selected? For now, no-op */ }}
        > 
          <Ionicons name="location-outline" size={20} color="#666" /> 
          {selectedGym ? ( 
            // Display selected gym 
            <View style={styles.gymSelectedContainer}> 
              <Text style={styles.gymSelectedText} numberOfLines={1}>{selectedGym.name}</Text> 
              <TouchableOpacity onPress={handleRemoveSelectedGym} style={styles.removeTagButton}> 
                <Ionicons name="close-circle" size={18} color="#666" /> 
              </TouchableOpacity> 
            </View> 
          ) : ( 
            // Show search input 
            <TextInput 
              style={styles.gymInput} // New style for the input 
              value={gymInput} 
              onChangeText={setGymInput} 
              placeholder="Search or add a gym" 
              placeholderTextColor="#999" // Use a standard placeholder color 
            /> 
          )} 
        </TouchableOpacity> 

        {/* Search Results List & Add Button (Rendered below the input area) */} 
        {!selectedGym && ( // Only show results/add button when input is visible
          <React.Fragment> 
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
            {gymInput.trim().length > 0 && !isSearchingGyms && !isExactMatchInSearch && ( 
              <TouchableOpacity style={styles.addNewButton} onPress={handleAddNewGym}> 
                <Ionicons name="add-circle-outline" size={18} color="#4E6E5D" style={{ marginRight: 5 }}/> 
                <Text style={styles.addNewButtonText}>Add "{gymInput.trim()}"</Text> 
              </TouchableOpacity> 
            )} 
          </React.Fragment> 
        )} 
      </View>

      {/* Difficulty Grade Input */}
      <View style={[styles.section, { zIndex: 990 }]}> 
        {/* Grading System Selector */}
        <View style={styles.gradingSystemSelector}> 
          {(['V Scale', 'Color'] as GradingSystem[]).map((system) => ( 
            <TouchableOpacity 
              key={system} 
              style={[ 
                styles.gradingSystemButton, 
                gradingSystem === system && styles.gradingSystemButtonActive, 
              ]} 
              onPress={() => {
                setGradingSystem(system); 
                setDifficulty(''); // Reset difficulty when switching systems
                setIsGradeDropdownOpen(false); // Close dropdown if open
              }}
            > 
              <Text 
                style={[ 
                  styles.gradingSystemButtonText, 
                  gradingSystem === system && styles.gradingSystemButtonTextActive, 
                ]} 
              > 
                {system} 
              </Text> 
            </TouchableOpacity> 
          ))} 
        </View>

        {/* Difficulty Button */} 
        <TouchableOpacity 
          style={styles.gradeButton}
          onPress={() => setIsGradeDropdownOpen(!isGradeDropdownOpen)} // Toggle dropdown
        >
          <Ionicons name="stats-chart-outline" size={20} color="#666" />
          <Text 
            style={[styles.gradeButtonText, difficulty ? styles.gradeSelected : styles.gradePlaceholder]}
            numberOfLines={1}
          >
            {difficulty || `Select ${gradingSystem === 'V Scale' ? 'V Grade' : 'Color'}`} {/* Updated placeholder */}
          </Text>
          <Ionicons 
            name={isGradeDropdownOpen ? "chevron-up" : "chevron-down"} 
            size={20} 
            color="#666" 
          />
        </TouchableOpacity>

        {/* Conditionally rendered Dropdown View */} 
        {isGradeDropdownOpen && ( 
          <View style={styles.gradeDropdown}> 
            <ScrollView> 
              {(gradingSystem === 'V Scale' ? BOULDER_GRADES : COLOR_GRADES).map((grade) => ( 
                <TouchableOpacity 
                  key={grade} 
                  style={styles.gradeDropdownItem} 
                  onPress={() => { 
                    setDifficulty(grade); 
                    setIsGradeDropdownOpen(false); 
                  }} 
                >
                  <Text style={styles.gradeDropdownItemText}>{grade}</Text>{/* Display only grade/color */}
                </TouchableOpacity> 
              ))} 
            </ScrollView> 
          </View> 
        )} 
      </View>

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
                      style={[styles.input, styles.modalInput]}
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

      {/* Share Button */}
      <TouchableOpacity 
        style={[
          styles.shareButton, 
          (!image || !caption || !selectedGym || !difficulty || isSaving) && styles.shareButtonDisabled
        ]}
        onPress={createPost}
        disabled={!image || !caption || !selectedGym || !difficulty || isSaving}
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
  gymSection: {
    zIndex: 1000,
  },
  gymButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  gymSelectedContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 8,
  },
  gymSelectedText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#000',
    flexShrink: 1,
    marginRight: 8,
  },
  gymInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    marginBottom: 0,
    color: '#000',
  },
  removeTagButton: {
    padding: 2,
  },
  searchIndicator: {
    marginTop: 5,
    marginBottom: 10,
    alignSelf: 'center',
    position: 'absolute',
    top: 80,
    left: 16,
    right: 16,
    backgroundColor: 'white',
  },
  resultsList: {
    maxHeight: 150,
    borderColor: '#e0e0e0',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
  },
  resultItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  resultText: {
    fontFamily: 'Inter_400Regular',
  },
  addNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    marginTop: 5,
    alignSelf: 'flex-start',
  },
  addNewButtonText: {
    fontFamily: 'Inter_500Medium',
    color: '#4E6E5D',
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
  // --- New Dropdown Styles ---
  gradeDropdown: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginTop: 5, // Space below the button
    backgroundColor: 'white', // Background for the dropdown
  },
  gradeDropdownItem: {
    padding: 12, // More padding
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  gradeDropdownItemText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16, // Match input font size
  },
  // --- Styles for Add Gym Modal (Keep these) ---
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
  modalLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#555',
    marginBottom: 6,
    marginTop: 10,
  },
  modalInput: {
    marginBottom: 15,
    backgroundColor: '#F8F8F8',
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
    color: '#FFF',
  },
  modalButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: '#FFF',
  },
  cancelButtonText: {
    color: '#555',
  },
  buttonDisabled: {
    opacity: 0.6,
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
  // Input style used by modal inputs 
  input: { // ADD BACK - Needed for Modal Inputs
    backgroundColor: '#F8F8F8',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    marginBottom: 10,
    color: '#333',
  },
  // --- Restore Necessary Modal Styles ---
  
  modalOverlay: { // KEEP / RESTORE - Used by Add Gym Modal
    flex: 1, 
    backgroundColor: 'rgba(0, 0, 0, 0.5)', 
    justifyContent: 'center', 
    alignItems: 'center', 
  }, 
  modalTitle: { // KEEP / RESTORE - Used by Add Gym Modal
    fontSize: 18, 
    fontFamily: 'Inter_600SemiBold', 
    marginBottom: 20, 
    textAlign: 'center', 
  }, 
  gradingSystemSelector: {
    flexDirection: 'row',
    marginBottom: 12, // Add space below the selector
    gap: 8, // Add space between buttons
  },
  gradingSystemButton: {
    flex: 1, // Make buttons take equal width
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  gradingSystemButtonActive: {
    borderColor: '#4E6E5D',
    backgroundColor: '#E8F5E9',
  },
  gradingSystemButtonText: {
    fontFamily: 'Inter_500Medium',
    color: '#666',
    fontSize: 14,
  },
  gradingSystemButtonTextActive: {
    color: '#4E6E5D',
  },
}); 