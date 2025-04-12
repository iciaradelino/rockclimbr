import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }: {
          focused: boolean;
          color: string;
          size: number;
        }) => {
          const iconMap: { [key: string]: keyof typeof Ionicons.glyphMap } = {
            index: focused ? 'compass' : 'compass-outline',
            progress: focused ? 'stats-chart' : 'stats-chart-outline',
            post: focused ? 'add-circle' : 'add-circle-outline',
            profile: focused ? 'person' : 'person-outline',
          };

          return <Ionicons name={iconMap[route.name] || 'alert-circle'} size={28} color={color} />;
        },
        tabBarActiveTintColor: '#4E6E5D',
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: '#fff',
        },
        headerTitleStyle: {
          fontFamily: 'Inter_600SemiBold',
        },
        tabBarStyle: {
          height: 50,
          paddingBottom: 4,
          paddingTop: 4,
        },
        tabBarShowLabel: false,
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Explore',
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'My Progress',
        }}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: "Create a post",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'My Profile',
        }}
      />
    </Tabs>
  );
} 