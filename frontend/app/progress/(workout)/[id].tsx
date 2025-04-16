import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, Workout } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DIFFICULTY_COLORS = {
  'Blue (V0-V1)': '#3498db',
  'Red (V2-V3)': '#4E6E5D',
  'Black (V4-V5)': '#2c3e50',
  'Purple (V6+)': '#9b59b6',
};

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams();
  const { token } = useAuth();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const insets = useSafeAreaInsets();

  const loadWorkout = async () => {
    setLoading(true);
    try {
      if (!token) {
        setError('Not authenticated');
        return;
      }
      
      if (!id) {
        setError('No workout ID provided');
        return;
      }
      
      const data = await api.getWorkout(token, id as string);
      setWorkout(data);
    } catch (err) {
      setError('Failed to load workout details');
      console.error('Error loading workout:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkout();
    // Test alert removed
    // console.log('Attempting test alert on mount');
    // Alert.alert('Test Alert', 'Does this basic alert appear?');
  }, [id]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const deleteWorkout = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    
    try {
      if (!token) {
        console.error('Delete Workout Error: No authentication token found.');
        Alert.alert('Error', 'Authentication error. Please log in again.');
        setIsDeleting(false);
        return;
      }
      
      if (!id || typeof id !== 'string') {
         console.error('Delete Workout Error: Invalid or missing workout ID.');
         Alert.alert('Error', 'Invalid workout ID.');
         setIsDeleting(false);
         return;
      }
      
      console.log(`Attempting to delete workout ID: ${id} using token...`);
      
      await api.deleteWorkout(token, id);
      
      console.log('Workout deleted successfully via API.');
      
      if (Platform.OS === 'web') {
        console.log('Web platform: Navigating back directly after successful deletion.');
        router.back();
      } else {
        console.log('Native platform: Showing success alert before navigating back.');
        Alert.alert(
          'Success',
          'Workout deleted successfully.',
          [{ text: 'OK', onPress: () => {
            console.log('Native alert OK pressed, navigating back.');
            router.back();
          }}]
        );
      }
      
    } catch (error: any) {
      console.error('Error during deleteWorkout API call:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete workout. Please try again.';
      Alert.alert('Deletion Failed', errorMessage);
      setIsDeleting(false);
    }
  };

  const confirmDelete = () => {
    const message = 'Are you sure you want to permanently delete this workout? This action cannot be undone.';
    const title = 'Confirm Deletion';

    if (Platform.OS === 'web') {
      console.log('Using window.confirm for web');
      if (window.confirm(message)) {
        console.log('Web confirmation successful, calling deleteWorkout');
        deleteWorkout();
      } else {
        console.log('Web confirmation cancelled by user.');
      }
    } else {
      // Use React Native Alert for native platforms
      console.log('Using Alert.alert for native');
      Alert.alert(
        title,
        message,
        [
          { 
            text: 'Cancel', 
            style: 'cancel',
            onPress: () => console.log('Native deletion cancelled by user.')
          },
          { 
            text: 'Delete', 
            style: 'destructive', 
            onPress: deleteWorkout 
          },
        ],
        { cancelable: true }
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4E6E5D" />
      </View>
    );
  }

  if (error || !workout) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'Workout not found'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadWorkout}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.retryButton, { marginTop: 12, backgroundColor: '#666' }]} 
          onPress={() => router.back()}
        >
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
          disabled={isDeleting}
        >
          <Ionicons name="arrow-back" size={24} color="#4E6E5D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {formatDate(workout.date)} Workout
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Location</Text>
              <Text style={styles.infoValue}>{workout.location}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Duration</Text>
              <Text style={styles.infoValue}>{workout.duration} hours</Text>
            </View>
          </View>

          {workout.session_feeling && (
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Session Rating</Text>
                <View style={styles.ratingContainer}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                      key={star}
                      name={parseInt(workout.session_feeling || '0') >= star ? 'star' : 'star-outline'}
                      size={18}
                      color="#4E6E5D"
                      style={{ marginRight: 2 }}
                    />
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Climbs</Text>
          {workout.climbs.map((climb, index) => (
            <View key={index} style={styles.climbEntry}>
              <View style={styles.climbInfo}>
                <View 
                  style={[
                    styles.gradeDot, 
                    { backgroundColor: DIFFICULTY_COLORS[climb.grade as keyof typeof DIFFICULTY_COLORS] || '#666' }
                  ]} 
                />
                <Text style={styles.climbGrade}>{climb.grade}</Text>
                <Text style={styles.climbName}>{climb.route_name}</Text>
              </View>
              <View style={styles.climbDetails}>
                <Text style={styles.climbAttempts}>
                  {climb.attempts} {climb.attempts === 1 ? 'attempt' : 'attempts'}
                </Text>
                <Text style={styles.climbStatus}>{climb.send_status}</Text>
              </View>
              {climb.notes && (
                <Text style={styles.climbNotes}>{climb.notes}</Text>
              )}
            </View>
          ))}
        </View>

        {workout.achievement && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Achievement</Text>
            <Text style={styles.achievementText}>{workout.achievement}</Text>
          </View>
        )}

        {workout.images && workout.images.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
              {workout.images.map((image, index) => (
                <Image 
                  key={index}
                  source={{ uri: image }}
                  style={styles.image}
                />
              ))}
            </ScrollView>
          </View>
        )}

        <TouchableOpacity 
          style={[styles.deleteWorkoutButton, isDeleting && styles.deleteButtonDisabled]}
          onPress={confirmDelete}
          disabled={isDeleting}
          activeOpacity={0.7}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color="#fff" style={styles.deleteIcon} />
          ) : (
            <Ionicons name="trash-bin" size={20} color="#fff" style={styles.deleteIcon} />
          )}
          <Text style={styles.deleteWorkoutButtonText}>
            {isDeleting ? 'Deleting...' : 'Delete Workout'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#1c1c1e',
    flex: 1,
    textAlign: 'left',
    marginLeft: 16,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 12,
    color: '#1c1c1e',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Inter_400Regular',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#1c1c1e',
    fontFamily: 'Inter_500Medium',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  climbEntry: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  climbInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  gradeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  climbGrade: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: '#4E6E5D',
    marginRight: 8,
  },
  climbName: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#1c1c1e',
    flex: 1,
  },
  climbDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  climbAttempts: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#666',
  },
  climbStatus: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#4E6E5D',
  },
  climbNotes: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  achievementText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#1c1c1e',
    lineHeight: 22,
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginRight: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'Inter_400Regular',
  },
  retryButton: {
    backgroundColor: '#4E6E5D',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  deleteWorkoutButton: {
    backgroundColor: '#e74c3c',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteButtonDisabled: {
    backgroundColor: '#f0a096',
  },
  deleteWorkoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginLeft: 8,
  },
  deleteIcon: {
    marginRight: 8,
  },
}); 