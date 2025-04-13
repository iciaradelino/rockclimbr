import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { 
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useCallback, useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { router, useFocusEffect } from 'expo-router';
import { api, Workout } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

const WorkoutCard = ({ workout, onPress }: { workout: Workout, onPress: () => void }) => (
  <TouchableOpacity style={styles.workoutCard} onPress={onPress}>
    <View style={styles.workoutHeader}>
      <Text style={styles.workoutDate}>{new Date(workout.date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      })}</Text>
      <Text style={styles.workoutLocation}>{workout.location}</Text>
    </View>
    {workout.climbs.map((climb, index) => (
      <View key={index} style={styles.routeItem}>
        <View style={styles.routeDetails}>
          <Text style={styles.routeGrade}>{climb.grade}</Text>
        </View>
      </View>
    ))}
  </TouchableOpacity>
);

export default function ProgressScreen() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  const loadWorkouts = async () => {
    try {
      if (!token) {
        setError('Not authenticated');
        return;
      }
      const data = await api.getWorkouts(token);
      console.log('Loaded workouts:', data); // Debug log
      setWorkouts(data);
    } catch (err) {
      setError('Failed to load workouts');
      console.error('Error loading workouts:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load workouts when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadWorkouts();
    }, [])
  );

  // Create marked dates for the calendar
  const markedDates = workouts.reduce((acc, workout) => {
    const date = new Date(workout.date).toISOString().split('T')[0];
    acc[date] = { marked: true, dotColor: '#4E6E5D' };
    return acc;
  }, {} as Record<string, { marked: boolean; dotColor: string }>);

  const onDayPress = useCallback((day: { dateString: string }) => {
    // You could implement filtering by date here if needed
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4E6E5D" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadWorkouts}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity 
        style={styles.addButton}
        onPress={() => router.push('/workouts/workout')}
      >
        <Text style={styles.addButtonText}>Add Today's Workout</Text>
      </TouchableOpacity>

      <View style={styles.calendarContainer}>
        <Calendar
          onDayPress={onDayPress}
          markedDates={markedDates}
          theme={{
            calendarBackground: '#fff',
            textSectionTitleColor: '#4E6E5D',
            selectedDayBackgroundColor: '#4E6E5D',
            selectedDayTextColor: '#ffffff',
            todayTextColor: '#4E6E5D',
            dayTextColor: '#2d4150',
            textDisabledColor: '#d9e1e8',
            dotColor: '#4E6E5D',
            selectedDotColor: '#ffffff',
            arrowColor: '#4E6E5D',
            monthTextColor: '#4E6E5D',
            indicatorColor: '#4E6E5D',
            textDayFontFamily: 'Inter_400Regular',
            textMonthFontFamily: 'Inter_600SemiBold',
            textDayHeaderFontFamily: 'Inter_500Medium',
            textDayFontSize: 14,
            textMonthFontSize: 16,
            textDayHeaderFontSize: 13
          }}
        />
      </View>
      
      <View style={styles.workoutsContainer}>
        <Text style={styles.sectionTitle}>Recent Workouts</Text>
        {workouts.length === 0 ? (
          <Text style={styles.emptyText}>No workouts yet. Add your first workout!</Text>
        ) : (
          workouts.map((workout) => (
            <WorkoutCard 
              key={workout._id} 
              workout={workout} 
              onPress={() => {
                console.log('Navigating to workout detail with ID:', workout._id);
                router.push(`/workouts/${workout._id}`);
              }}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  addButton: {
    backgroundColor: '#4E6E5D',
    paddingVertical: 16,
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  calendarContainer: {
    padding: 16,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
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
  workoutsContainer: {
    padding: 16,
    backgroundColor: '#fff',
    marginTop: 8,
    marginHorizontal: 2,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 16,
    marginLeft: 6,
    color: '#1c1c1e',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    marginTop: 20,
  },
  workoutCard: {
    backgroundColor: '#fff',
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
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  workoutDate: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#1c1c1e',
  },
  workoutLocation: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#666',
  },
  routeItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  routeName: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: '#1c1c1e',
    marginBottom: 4,
  },
  routeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeGrade: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#4E6E5D',
  },
  routeStyle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#666',
  },
}); 