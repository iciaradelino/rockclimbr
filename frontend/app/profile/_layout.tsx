import { Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext'; // Corrected path

export default function ProfileLayout() {
  const { user } = useAuth();

  return (
    <Stack>
      <Stack.Screen
        name="following"
        options={{  
          title: 'Following',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="followers"
        options={{
          title: 'Followers',
          headerShown: true,
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