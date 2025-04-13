import { Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext'; // Corrected path

export default function ProfileLayout() {
  const { user } = useAuth();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      
      <Stack.Screen
        name="following"
        options={{
          headerShown: true,
          title: 'Following',
          headerBackTitle: 'Back'
        }}
      />
      <Stack.Screen
        name="followers"
        options={{
          headerShown: true,
          title: 'Followers',
          headerBackTitle: 'Back'
        }}
      />
      <Stack.Screen
        name="edit"
        options={{
          title: 'Edit Profile',
          headerShown: true,
        }}
      />
    </Stack>
  );
} 