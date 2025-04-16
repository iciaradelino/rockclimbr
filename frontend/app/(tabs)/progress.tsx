import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { LineChart } from "react-native-chart-kit";
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
import { api, Workout, Climb } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

// Helper function to parse grades into numerical values
// Handles "V<number>", "5.<number>[abcd]", and "Color (Grade)" formats.
// V-Scale: V0=0, V1=1, ... V10=10
// YDS: 5.6=6, 5.7=7, ..., 5.10a=10.0, 5.10b=10.25, ..., 5.12a=12.0
// Returns -1 for unrecognized grades or grades below V0/5.6
const parseGrade = (grade: string): number => {
  if (!grade) return -1;
  let gradeToParse = grade.toUpperCase().trim();

  // Check for "Color (Grade)" format and extract the Grade part
  const colorFormatMatch = gradeToParse.match(/\((V\d{1,2}|5\.\d{1,2}[ABCD]?)\)$/);
  if (colorFormatMatch && colorFormatMatch[1]) {
    gradeToParse = colorFormatMatch[1]; // Use the extracted grade (e.g., "V4")
  }

  // Now parse the potentially extracted grade or the original grade

  // V-Scale
  const vMatch = gradeToParse.match(/^V(\d{1,2})$/);
  if (vMatch && vMatch[1]) {
    const num = parseInt(vMatch[1], 10);
    return num >= 0 ? num : -1; // V0 = 0
  }

  // YDS
  const ydsMatch = gradeToParse.match(/^5\.(\d{1,2})([ABCD])?$/);
  if (ydsMatch && ydsMatch[1]) {
    const base = parseInt(ydsMatch[1], 10);
    // Start YDS mapping higher to avoid direct overlap with low V grades
    // e.g., map 5.6 to 6, 5.10 to 10, etc.
    if (base < 6) return -1; // Consider grades below 5.6 invalid for this scale

    let value = base;
    const letter = ydsMatch[2];

    if (letter === 'A') value += 0.0;
    else if (letter === 'B') value += 0.25;
    else if (letter === 'C') value += 0.5;
    else if (letter === 'D') value += 0.75;
    
    return value;
  }

  // Handle potential alternative formats if needed here...
  // Example: Font Scale mapping (adjust numbers as needed)
  // const fontMatch = grade.match(/^([4-8])[ABC]?\+?$/); // e.g., 6A, 7B+
  // if (fontMatch && fontMatch[1]) {
  //   // Implement Font mapping logic here, potentially offset from V/YDS
  //   return parseInt(fontMatch[1]) + 10; // Example offset
  // }

  return -1; // Indicate unrecognized grade
};

const findMaxGrade = (climbs: Climb[]): number => {
  if (!climbs || climbs.length === 0) return -1;
  
  return climbs.reduce((max, climb) => {
    const currentGrade = parseGrade(climb.grade);
    return currentGrade > max ? currentGrade : max;
  }, -1);
};

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
          {/* Optionally display numerical grade for debugging: */}
          {/* <Text style={styles.routeGrade}> ({parseGrade(climb.grade)})</Text> */}
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

  // Prepare data for the chart - Filter out workouts with no valid max grade
  const validWorkouts = workouts
    .map(w => ({
      date: new Date(w.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      maxGrade: findMaxGrade(w.climbs)
    }))
    .filter(w => w.maxGrade >= 0) // Only include workouts with a valid max grade (>= V0 / 5.6)
    .slice(-7); // Take the last 7 valid workouts

  const chartData = {
    labels: validWorkouts.map(w => w.date),
    datasets: [
      {
        data: validWorkouts.map(w => w.maxGrade),
        color: (opacity = 1) => `rgba(78, 110, 93, ${opacity})`,
        strokeWidth: 3 // Make line slightly thicker
      }
    ],
    // legend: ["Max Grade Climbed"] // Remove legend, title is sufficient
  };

  const screenWidth = Dimensions.get("window").width;
  const chartConfig = {
    backgroundGradientFromOpacity: 0, // Make background transparent
    backgroundGradientToOpacity: 0,
    color: (opacity = 1) => `rgba(78, 110, 93, ${opacity})`, // Main line/dot color
    labelColor: (opacity = 1) => `rgba(50, 50, 50, ${opacity})`, // Axis label color
    strokeWidth: 2, // optional, default 3
    barPercentage: 0.5,
    useShadowColorFromDataset: false, // optional
    decimalPlaces: 1, // Show one decimal place for grades like 10.25 (5.10b)
    propsForDots: {
      r: "5", // Dot radius
      strokeWidth: "2",
      stroke: "#4E6E5D", // Dot border color
      fill: "#4E6E5D" // Dot fill color
    },
    propsForBackgroundLines: {
        strokeDasharray: "", // solid lines
        stroke: "#e0e0e0", // Lighter grid lines
        strokeWidth: 0.5,
    }
  };

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
        onPress={() => router.push('/progress/add-workout')}
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
      
      {/* Grade Progression Chart */}
      {validWorkouts.length > 1 ? (
        <View style={styles.sectionWrapper}>
          <Text style={styles.sectionTitle}>Max Grade Progression (Last 7 days)</Text>
          <View style={styles.chartContainer}>
            <LineChart
              data={chartData}
              width={screenWidth - 36}
              height={200}
              chartConfig={chartConfig}
              bezier
              style={styles.chartStyle}
              yAxisInterval={1}
              fromZero={true}
            />
          </View>
        </View>
      ) : (
        workouts.length > 0 &&
        <View style={styles.sectionWrapper}>
          <Text style={styles.sectionTitle}>Max Grade Progression</Text>
          <View style={styles.chartContainer}>
            <Text style={styles.emptyChartText}>Log more workouts with valid grades (V0+/5.6+) to see progression.</Text>
          </View>
        </View>
      )}

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
                router.push(`/progress/${workout._id}`);
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
    marginBottom: 24,
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
    fontSize: 18,
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
  sectionWrapper: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    overflow: 'hidden',
    alignItems: 'center',
    paddingVertical: 14,
  },
  chartStyle: {
    borderRadius: 12,
  },
  emptyChartText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginTop: 20,
    paddingHorizontal: 10,
  },
}); 