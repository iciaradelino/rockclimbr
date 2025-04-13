import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, Image, ScrollView, TouchableOpacity, Alert, ActivityIndicator, FlatList } from 'react-native';
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

        try {
            setIsSavingProfile(true);
            
            try {
                const newGymData = await api.addGym(token, { name: gymInput.trim(), location: '' }); 
                addGymTag(newGymData);
            } catch (error: any) {
                if (error.message?.includes('CORS') || error.name === 'TypeError') {
                    throw new Error('Network connection error. Please check your connection and ensure the server is running.');
                } else {
                    throw error;
                }
            }
        } catch (error: any) {
            console.error("Error adding new gym:", error);
            Alert.alert("Error", error.message || "Failed to add gym.");
        } finally {
            setIsSavingProfile(false);
        }
    };
    // ----------------------

    const handleSaveChanges = async () => {
        if (!token) return;
        setIsSavingProfile(true);
        
        try {
            const currentGymIds = selectedGyms
                .filter(gym => gym && gym.id)
                .map(gym => gym.id);
            
            // Check if gym selection has changed
            const gymsChanged = initialGymIds.length !== currentGymIds.length || 
                !initialGymIds.every(id => currentGymIds.includes(id)) ||
                !currentGymIds.every(id => initialGymIds.includes(id));
            
            // Prepare update data with only changed fields
            const profileUpdateData: Partial<User> & { climbing_gym_ids?: string[], avatar_file?: any } = {};
            
            if (username !== user?.username) profileUpdateData.username = username;
            if (bio !== user?.bio) profileUpdateData.bio = bio;
            if (location !== user?.location) profileUpdateData.location = location;
            if (gymsChanged) profileUpdateData.climbing_gym_ids = currentGymIds;
            
            // Handle avatar separately since it needs file upload
            if (avatarChanged && avatarUri) {
                profileUpdateData.avatar_url = avatarUri;
            }
            
            // Check if there are any changes to save
            if (Object.keys(profileUpdateData).length === 0) {
                Alert.alert("No Changes", "You haven't made any changes to your profile details.");
                setIsSavingProfile(false);
                return;
            }
            
            // Test connectivity to server before making the actual update
            try {
                // Attempt to update
                await updateUser(profileUpdateData);
                
                // Success handling
                Alert.alert('Success', 'Profile updated successfully!');
                
                // Update our tracking of initial gym IDs after successful save
                if (gymsChanged) {
                    setInitialGymIds(currentGymIds);
                }
                
                if (avatarChanged) {
                    setAvatarChanged(false);
                }
                
                router.back();
            } catch (error: any) {
                // Handle specific error cases for network issues
                if (error.message?.includes('CORS') || error.name === 'TypeError') {
                    throw new Error('Network connection error. Please ensure the backend server is running and properly configured for CORS.');
                } else {
                    throw error; // Re-throw other errors
                }
            }
        } catch (error: any) {
            console.error('Error updating profile:', error);
            Alert.alert(
                'Error', 
                error.message || 'Failed to update profile. Please check your network connection and try again.'
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
});

export default EditProfileScreen; 