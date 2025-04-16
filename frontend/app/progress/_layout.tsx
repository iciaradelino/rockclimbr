import { Stack } from 'expo-router';

export default function ProgressLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="(workout)/[id]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="add-workout"
        options={{
          title: 'Add Workout',
          headerShown: true,
        }}
      />
    </Stack>
  );
} 