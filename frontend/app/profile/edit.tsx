import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, Image, ScrollView, TouchableOpacity, Alert, ActivityIndicator, FlatList, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { api, Gym, User } from '@/services/api';
import _ from 'lodash';

const EditProfileScreen = () => {
    const router = useRouter();
    const { user, token, refreshUserStats, updateUser, isLoading: authLoading } = useAuth();
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [location, setLocation] = useState('');
    const [selectedGyms, setSelectedGyms] = useState<Gym[]>([]);
    const [gymInput, setGymInput] = useState('');
    const [searchResults, setSearchResults] = useState<Gym[]>([]);
    const [isSearchingGyms, setIsSearchingGyms] = useState(false);
    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const [avatarChanged, setAvatarChanged] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isPasswordLoading, setIsPasswordLoading] = useState(false);
    const [initialGymIds, setInitialGymIds] = useState<string[]>([]);

    // --- State for Add Gym Modal ---
    const [isAddGymModalVisible, setIsAddGymModalVisible] = useState(false);
    const [newGymName, setNewGymName] = useState('');
    const [newGymLocation, setNewGymLocation] = useState('');
    const [newGymFranchise, setNewGymFranchise] = useState('');
    // -----------------------------

    useEffect(() => {
        if (user) {
            setUsername(user.username || '');
            setBio(user.bio || '');
            setLocation(user.location || '');
            const initialGyms = Array.isArray(user.climbing_gyms) ? user.climbing_gyms : [];
            setSelectedGyms(initialGyms);
            setInitialGymIds(initialGyms.map(g => g?.id).filter(Boolean));
            setAvatarUri(user.avatar_url || null);
            setAvatarChanged(false);
        }
    }, [user]);

    // --- Gym Search Logic ---
    const handleSearchGyms = async (query: string) => {
        if (!token || query.length < 2) {
            setSearchResults([]);
            return;
        }
        setIsSearchingGyms(true);
        try {
            const results = await api.searchGyms(token, query);
            setSearchResults(results);
        } catch (error) {
            console.error("Error searching gyms:", error);
            setSearchResults([]);
        } finally {
            setIsSearchingGyms(false);
        }
    };

    // Debounce the search function
    const debouncedSearch = useCallback(
        _.debounce(handleSearchGyms, 300), 
        [token]
    );

    useEffect(() => {
        debouncedSearch(gymInput);
        return () => {
            debouncedSearch.cancel();
        };
    }, [gymInput, debouncedSearch]);
    // ----------------------

    const pickImage = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
            Alert.alert("Permission required", "You need to allow access to your photos to change your profile picture.");
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled) {
            setAvatarUri(result.assets[0].uri);
            setAvatarChanged(true);
        }
    };

    // --- Gym Tag Handlers ---
    const addGymTag = (gymData: any) => {
        const gym: Gym = {
            id: gymData._id || gymData.id,
            name: gymData.name,
            location: gymData.location || ''
        };

        if (!selectedGyms.some(selected => selected.id === gym.id)) {
            setSelectedGyms(prev => [...prev, gym]);
        }
        setGymInput('');
        setSearchResults([]);
    };

    const removeGymTag = (gymIdToRemove: string) => {
        setSelectedGyms(prev => prev.filter(gym => gym.id !== gymIdToRemove));
    };

    const handleAddNewGym = async () => {
        if (!token || !gymInput.trim()) return;

        if (selectedGyms.some(g => g.name.toLowerCase() === gymInput.trim().toLowerCase())) {
            Alert.alert("Already Added", "This gym is already in your list.");
            setGymInput('');
            setSearchResults([]);
            return;
        }

        // --- Open Modal instead of direct add ---
        setNewGymName(gymInput.trim()); // Pre-fill name
        setNewGymLocation('');          // Reset location
        setNewGymFranchise('');         // Reset franchise
        setIsAddGymModalVisible(true);
        setGymInput('');               // Clear the search input
        setSearchResults([]);          // Clear search results
        // ----------------------------------------
    };

    // --- Modal Submit/Cancel Handlers ---
    const handleSubmitNewGymDetails = async () => {
        if (!token || !newGymName || !newGymLocation) {
            Alert.alert("Missing Information", "Please provide both a name and location for the gym.");
            return;
        }
        setIsSavingProfile(true); // Use the existing loading state
        try {
            console.log("Adding gym with details:", { name: newGymName, location: newGymLocation, franchise: newGymFranchise });
            // Pass franchise to the API call
            const addedGym = await api.addGym(token, { 
                name: newGymName, 
                location: newGymLocation, 
                franchise: newGymFranchise || undefined // Send undefined if empty 
            });
            addGymTag(addedGym); // Add the newly created gym to the selected list
            setIsAddGymModalVisible(false); // Close modal on success
        } catch (error: any) {
            console.error("Error adding new gym via modal:", error);
            Alert.alert("Error", error.message || "Failed to add gym.");
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleCancelAddGym = () => {
        setIsAddGymModalVisible(false);
        // Reset modal fields if needed
        setNewGymName('');
        setNewGymLocation('');
        setNewGymFranchise('');
    };
    // ------------------------------------

    const handleSaveChanges = async () => {
        if (!token) return;
        setIsSavingProfile(true);
        let profileUpdated = false;
        let avatarUpdated = false;

        try {
            let updatedAvatarUrl: string | null = null;

            // 1. Update Avatar if changed
            if (avatarChanged && avatarUri && avatarUri.startsWith('file:')) {
                try {
                    console.log('Attempting to update avatar...');
                    const avatarResult = await api.updateAvatar(token, avatarUri);
                    updatedAvatarUrl = avatarResult.avatar_url; // Get the new URL from backend
                    avatarUpdated = true;
                    console.log('Avatar updated successfully, new URL:', updatedAvatarUrl);
                } catch (avatarError) {
                    console.error('Error updating avatar:', avatarError);
                    Alert.alert('Avatar Error', 'Failed to update profile picture.');
                    // Decide if we should stop or continue with profile update
                    setIsSavingProfile(false);
                    return; // Stop if avatar update fails
                }
            }

            // 2. Prepare and Update Profile Data (excluding avatar)
            const currentGymIds = selectedGyms
                .filter(gym => gym && gym.id)
                .map(gym => gym.id);

            const gymsChanged = initialGymIds.length !== currentGymIds.length ||
                !initialGymIds.every(id => currentGymIds.includes(id)) ||
                !currentGymIds.every(id => initialGymIds.includes(id));

            const profileUpdateData: Partial<User> & { climbing_gym_ids?: string[] } = {};
            if (username !== user?.username) profileUpdateData.username = username;
            if (bio !== user?.bio) profileUpdateData.bio = bio;
            if (location !== user?.location) profileUpdateData.location = location;
            if (gymsChanged) profileUpdateData.climbing_gym_ids = currentGymIds;
            // DO NOT include avatar_url or avatar_file_uri here

            // Only call updateUser if there are changes to profile fields
            if (Object.keys(profileUpdateData).length > 0) {
                try {
                    console.log('Attempting to update profile data:', profileUpdateData);
                    await updateUser(profileUpdateData); // updateUser is from AuthContext
                    profileUpdated = true;
                    console.log('Profile data updated successfully.');
                } catch (profileError) {
                    console.error('Error updating profile data:', profileError);
                    // Handle profile update error (maybe rollback avatar change? unlikely needed)
                    Alert.alert('Profile Error', 'Failed to update profile details.');
                    // If avatar was updated but profile failed, user might be in inconsistent state
                    // We still proceed to refresh to get potentially partially updated data
                }
            }

            // 3. Check if anything was actually updated
            if (!profileUpdated && !avatarUpdated) {
                Alert.alert("No Changes", "You haven't made any changes.");
                setIsSavingProfile(false);
                return;
            }

            // 4. Refresh user data from context *after* all updates
            try {
                 console.log('Refreshing user stats after updates...');
                 await refreshUserStats();
                 console.log('User stats refreshed.');
            } catch (refreshError) {
                 console.error('Error refreshing user stats after update:', refreshError);
                 // Inform user, but proceed with navigation
                 Alert.alert('Refresh Error', 'Could not fully refresh profile data. Please pull down to refresh.');
            }

            Alert.alert("Success", "Profile updated successfully!");
            setAvatarChanged(false); // Reset avatar changed flag regardless of success/failure of refresh
            router.back(); // Navigate back

        } catch (error: any) {
            // Catch any unexpected errors not caught by specific try/catch blocks
            console.error('Unexpected error during save process:', error);
            Alert.alert(
                'Error',
                error.message || 'An unexpected error occurred while saving.'
            );
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleChangePassword = async () => {
        if (!token) return;
        if (!currentPassword || !newPassword || !confirmNewPassword) {
            Alert.alert('Missing Fields', 'Please fill in all password fields.');
            return;
        }
        if (newPassword !== confirmNewPassword) {
            Alert.alert('Password Mismatch', 'New passwords do not match.');
            return;
        }

        setIsPasswordLoading(true);
        try {
            try {
                const result = await api.updatePassword(token, {
                    current_password: currentPassword,
                    new_password: newPassword,
                });
                
                Alert.alert('Success', result.message || 'Password updated successfully!');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmNewPassword('');
            } catch (error: any) {
                if (error.message?.includes('CORS') || error.name === 'TypeError') {
                    throw new Error('Network connection error. Please ensure the backend server is running and properly configured for CORS.');
                } else {
                    throw error;
                }
            }
        } catch (error: any) {
            console.error('Error updating password:', error);
            Alert.alert(
                'Error', 
                error.message || 'Failed to update password. Please check your network connection and try again.'
            );
        } finally {
            setIsPasswordLoading(false);
        }
    };

    if (!user || authLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4E6E5D" />
                <Text style={styles.loadingText}>Loading profile...</Text>
            </View>
        );
    }

    const isExactMatchInSearch = searchResults.some(
        (result) => result.name.toLowerCase() === gymInput.trim().toLowerCase()
    );

    // Generate gym result key extractor function
    const keyExtractor = (item: Gym) => {
        // Use type assertion to handle potential _id property from backend
        const gymData = item as Gym & { _id?: string };
        return `gym-${gymData.id || gymData._id || gymData.name}-${Date.now()}`;
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
            <View style={styles.avatarContainer}>
                <Image
                    source={avatarUri ? 
                        (avatarUri.startsWith('http') || avatarUri.startsWith('file:')) ? 
                            { uri: avatarUri } : 
                            require('../../assets/images/default-avatar.jpg')
                        : require('../../assets/images/default-avatar.jpg')}
                    style={styles.avatar}
                />
                <TouchableOpacity onPress={pickImage} style={styles.changeAvatarButton}>
                    <Text style={styles.changeAvatarText}>Change Picture</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.formSection}>
                <Text style={styles.label}>Username</Text>
                <TextInput
                    style={styles.input}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Enter your username"
                    autoCapitalize="none"
                    placeholderTextColor="#999"
                />

                <Text style={styles.label}>Bio</Text>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    value={bio}
                    onChangeText={setBio}
                    placeholder="Tell us about yourself"
                    multiline
                    placeholderTextColor="#999"
                />

                <Text style={styles.label}>Location</Text>
                <TextInput
                    style={styles.input}
                    value={location}
                    onChangeText={setLocation}
                    placeholder="Where are you based?"
                    placeholderTextColor="#999"
                />

                {/* --- Gym Input Section --- */}
                <Text style={styles.label}>Climbing Gyms</Text>
                
                {/* Display Selected Gym Tags */}
                <View style={styles.tagsContainer}>
                    {selectedGyms.map((gym) => (
                        <View key={`selected-${gym.id}`} style={styles.tag}>
                            <Text style={styles.tagText}>{gym.name}</Text>
                            <TouchableOpacity onPress={() => removeGymTag(gym.id)} style={styles.removeTagButton}>
                                <Ionicons name="close-circle" size={18} color="#666" />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>

                {/* Gym Text Input */}
                <TextInput
                    style={styles.input}
                    value={gymInput}
                    onChangeText={setGymInput}
                    placeholder="Search or add a gym"
                    placeholderTextColor="#999"
                />

                {/* Search Results List */}
                {isSearchingGyms && <ActivityIndicator style={styles.searchIndicator} size="small" color="#4E6E5D" />}
                {searchResults.length > 0 && (
                    <FlatList
                        style={styles.resultsList}
                        data={searchResults}
                        keyExtractor={keyExtractor}
                        renderItem={({ item }) => (
                            <TouchableOpacity 
                                style={styles.resultItem} 
                                onPress={() => addGymTag(item)}
                            >
                                <Text style={styles.resultText}>{item.name}</Text>
                            </TouchableOpacity>
                        )}
                    />
                )}

                {/* Add New Gym Button */}
                {gymInput.trim().length > 0 && !isSearchingGyms && !isExactMatchInSearch && (
                     <TouchableOpacity style={styles.addNewButton} onPress={handleAddNewGym}>
                        <Ionicons name="add-circle-outline" size={18} color="#4E6E5D" style={{ marginRight: 5 }}/>
                        <Text style={styles.addNewButtonText}>Add "{gymInput.trim()}"</Text>
                    </TouchableOpacity>
                )}
                {/* -------------------------------- */}

                <TouchableOpacity 
                    style={[styles.button, (isSavingProfile || isPasswordLoading) && styles.buttonDisabled]} 
                    onPress={handleSaveChanges}
                    disabled={isSavingProfile || isPasswordLoading}
                >
                    {isSavingProfile ? (
                        <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                        <Text style={styles.buttonText}>Save Profile Changes</Text>
                    )}
                </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Change Password</Text>

                <Text style={styles.label}>Current Password</Text>
                <TextInput
                    style={styles.input}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Enter your current password"
                    secureTextEntry
                    placeholderTextColor="#999"
                />

                <Text style={styles.label}>New Password</Text>
                <TextInput
                    style={styles.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter your new password"
                    secureTextEntry
                    placeholderTextColor="#999"
                />

                <Text style={styles.label}>Confirm New Password</Text>
                <TextInput
                    style={styles.input}
                    value={confirmNewPassword}
                    onChangeText={setConfirmNewPassword}
                    placeholder="Confirm your new password"
                    secureTextEntry
                    placeholderTextColor="#999"
                />

                <TouchableOpacity 
                    style={[styles.button, styles.passwordButton, isPasswordLoading && styles.buttonDisabled]} 
                    onPress={handleChangePassword}
                    disabled={isSavingProfile || isPasswordLoading}
                >
                    {isPasswordLoading ? (
                        <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                        <>
                            <Ionicons name="lock-closed-outline" size={18} color="#FFF" />
                            <Text style={styles.buttonText}>Change Password</Text>
                        </>
                    )}
                </TouchableOpacity>
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
                            style={[styles.input, styles.modalInput]} // Re-use input style
                            value={newGymName}
                            // editable={false} // Keep it editable in case user mistyped
                            onChangeText={setNewGymName}
                            placeholder="Gym Name"
                            placeholderTextColor="#999"
                        />

                        <Text style={styles.modalLabel}>Location</Text>
                        {/* Replace LocationAutocomplete with TextInput */}
                        <TextInput
                            style={[styles.input, styles.modalInput]}
                            value={newGymLocation}
                            onChangeText={setNewGymLocation}
                            placeholder="Enter gym address or city"
                            placeholderTextColor="#999"
                        />

                        <Text style={styles.modalLabel}>Franchise (Optional)</Text>
                        <TextInput
                            style={[styles.input, styles.modalInput]} // Re-use input style
                            value={newGymFranchise}
                            onChangeText={setNewGymFranchise}
                            placeholder="e.g., Movement, Planet Granite"
                            placeholderTextColor="#999"
                        />

                        <View style={styles.modalButtonContainer}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={handleCancelAddGym}
                                disabled={isSavingProfile}
                            >
                                <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.submitButton, isSavingProfile && styles.buttonDisabled]}
                                onPress={handleSubmitNewGymDetails}
                                disabled={isSavingProfile}
                            >
                                {isSavingProfile ? (
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
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    contentContainer: {
        paddingBottom: 40,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        fontFamily: 'Inter_400Regular',
        color: '#4E6E5D',
    },
    avatarContainer: {
        alignItems: 'center',
        paddingVertical: 32,
        backgroundColor: '#F8F8F8',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        marginBottom: 16,
        backgroundColor: '#e0e0e0',
        borderWidth: 3,
        borderColor: '#4E6E5D',
    },
    changeAvatarButton: {
        padding: 8,
    },
    changeAvatarText: {
        color: '#4E6E5D',
        fontSize: 16,
        fontFamily: 'Inter_500Medium',
    },
    formSection: {
        padding: 20,
    },
    label: {
        fontSize: 14,
        fontFamily: 'Inter_600SemiBold',
        color: '#333',
        marginBottom: 8,
    },
    input: {
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
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    button: {
        backgroundColor: '#4E6E5D',
        borderRadius: 8,
        padding: 15,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 8,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: '#FFF',
        fontSize: 16,
        fontFamily: 'Inter_600SemiBold',
        marginLeft: 8,
    },
    passwordButton: {
        backgroundColor: '#FF8C00',
    },
    divider: {
        height: 8,
        backgroundColor: '#F8F8F8',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E0E0E0',
    },
    sectionTitle: {
        fontSize: 20,
        fontFamily: 'Inter_600SemiBold',
        color: '#333',
        marginBottom: 20,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 10,
    },
    tag: {
        flexDirection: 'row',
        backgroundColor: '#e0e0e0',
        borderRadius: 15,
        paddingVertical: 5,
        paddingHorizontal: 10,
        marginRight: 5,
        marginBottom: 5,
        alignItems: 'center',
    },
    tagText: {
        fontFamily: 'Inter_400Regular',
        color: '#333',
        marginRight: 4,
    },
    removeTagButton: {
        padding: 2,
    },
    searchIndicator: {
        marginTop: 5,
        marginBottom: 10,
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
        marginBottom: 20,
        alignSelf: 'flex-start',
    },
    addNewButtonText: {
        fontFamily: 'Inter_500Medium',
        color: '#4E6E5D',
    },
    // --- Modal Styles ---
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent background
    },
    modalContainer: {
        width: '90%',
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 25,
        alignItems: 'stretch', // Stretch items to fill width
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
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
        marginTop: 10, // Add some space above labels
    },
    modalInput: {
        marginBottom: 15, // Increase space below inputs
        backgroundColor: '#F8F8F8', // Match other inputs
        // Inherits other styles from 'input'
    },
    modalButtonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between', // Space out buttons
        marginTop: 25,
    },
    modalButton: {
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 20,
        flex: 1, // Make buttons take equal space
        alignItems: 'center',
        marginHorizontal: 5, // Add space between buttons
    },
    cancelButton: {
        backgroundColor: '#f0f0f0', // Lighter background for cancel
        borderWidth: 1,
        borderColor: '#ccc',
    },
    submitButton: {
        backgroundColor: '#4E6E5D', // Primary color for submit
    },
    modalButtonText: {
        fontSize: 16,
        fontFamily: 'Inter_500Medium',
        color: '#FFF',
    },
    cancelButtonText: {
        color: '#555', // Darker text for cancel
    },
    // ------------------
});

export default EditProfileScreen; 