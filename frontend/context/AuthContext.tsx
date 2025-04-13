import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useSegments, useRootNavigationState } from 'expo-router';
import { api, User } from '@/services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: {
    username: string;
    email: string;
    password: string;
    bio?: string;
    location?: string;
    avatar_url?: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  refreshUserStats: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// This hook can be used to protect routes that require authentication
export function useProtectedRoute(requireAuth: boolean) {
  const segments = useSegments();
  const { user, isLoading } = useAuth();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (!navigationState?.key || isLoading) return;

    const inAuthGroup = segments[0] === 'auth';
    
    if (
      // If the user is not signed in and the initial segment is not anything in the auth group.
      !user &&
      requireAuth &&
      !inAuthGroup
    ) {
      router.replace('/auth/signup');
    } else if (user && inAuthGroup) {
      // Redirect away from the sign-in page.
      router.replace('/(tabs)');
    }
  }, [user, segments, isLoading, navigationState?.key]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    user: null,
    token: null,
  });

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        try {
          const user = await api.getCurrentUser(token);
          setState({ user, token, isLoading: false });
          // Navigate to tabs if user is authenticated
          router.replace('/(tabs)');
        } catch (error) {
          console.error('Error loading user from token:', error);
          await AsyncStorage.removeItem('token');
          setState({ user: null, token: null, isLoading: false });
          router.replace('/auth/signup');
        }
      } else {
        setState({ user: null, token: null, isLoading: false });
        router.replace('/auth/signup');
      }
    } catch (error) {
      console.error('Error loading user:', error);
      await AsyncStorage.removeItem('token');
      setState({ user: null, token: null, isLoading: false });
      router.replace('/auth/signup');
    }
  }

  async function signIn(email: string, password: string) {
    try {
      const response = await api.login({ email, password });
      await AsyncStorage.setItem('token', response.access_token);
      setState({
        user: response.user,
        token: response.access_token,
        isLoading: false,
      });
      
      // Navigate to tabs after successful login
      console.log('Login successful, navigating to tabs');
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  }

  async function signUp(data: {
    username: string;
    email: string;
    password: string;
    bio?: string;
    location?: string;
    avatar_url?: string;
  }) {
    try {
      const response = await api.register(data);
      await AsyncStorage.setItem('token', response.access_token);
      setState({
        user: response.user,
        token: response.access_token,
        isLoading: false,
      });
      
      // Navigate to tabs after successful registration
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  }

  async function signOut() {
    try {
      console.log('AuthContext - Signing out...');
      
      // First update state to ensure UI responds immediately
      setState({ user: null, token: null, isLoading: true });
      console.log('AuthContext - State reset');
      
      // Then remove the token
      await AsyncStorage.removeItem('token');
      console.log('AuthContext - Token removed from AsyncStorage');
      
      // Set final state
      setState({ user: null, token: null, isLoading: false });
      
      // Force a reload of the application by navigating to the index screen
      console.log('AuthContext - Forcing application restart...');
      router.replace('/');
      
      // Additional fallback for navigation
      setTimeout(() => {
        console.log('AuthContext - Delayed navigation to signup...');
        router.push('/auth/signup');
      }, 500);
    } catch (error) {
      console.error('AuthContext - Error signing out:', error);
      throw error;
    }
  }

  async function updateUser(data: Partial<User>) {
    try {
      if (!state.token) throw new Error('No token found');
      const updatedUser = await api.updateProfile(state.token, data);
      console.log('AuthContext updateUser - API response:', JSON.stringify(updatedUser));
      setState(prevState => {
        const newState = { ...prevState, user: updatedUser };
        console.log('AuthContext updateUser - State updated:', JSON.stringify(newState.user));
        return newState;
      });
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  async function refreshUserStats() {
    try {
      if (!state.token) throw new Error('No token found');
      console.log('Refreshing user stats...');
      
      // Log current user state before refresh
      console.log('BEFORE refresh - Current user stats:', state.user?.stats);
      
      const updatedUser = await api.getCurrentUser(state.token);
      
      // Log received data from API
      console.log('API response - Updated user data:', updatedUser);
      console.log('API response - Updated stats:', updatedUser.stats);
      
      // Add more detailed logging for climbing gyms
      if (updatedUser.climbing_gyms) {
        console.log('API response - Climbing gyms:', updatedUser.climbing_gyms);
      } else if (updatedUser.climbing_gym_ids) {
        console.log('API response - Climbing gym IDs (needs conversion):', updatedUser.climbing_gym_ids);
      }
      
      // Update state with new user data
      setState({ ...state, user: updatedUser });
      
      // Verify state was updated with a timeout
      setTimeout(() => {
        console.log('AFTER refresh - Updated user stats:', state.user?.stats);
        // Log climbing gyms as well
        if (state.user?.climbing_gyms) {
          console.log('AFTER refresh - User climbing gyms:', state.user.climbing_gyms);
        }
      }, 100);
      
      console.log('User stats refresh complete');
    } catch (error) {
      console.error('Error refreshing user stats:', error);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signIn,
        signUp,
        signOut,
        updateUser,
        refreshUserStats,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Export a default component to satisfy Expo Router
export default function AuthContextExport() {
  return null;
} 