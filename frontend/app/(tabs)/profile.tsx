import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useState, useCallback, Fragment, useEffect } from 'react';
import { api, Post } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

// This would typically come from your backend
const DUMMY_POSTS = [
  {
    id: '1',
    imageUrl: 'https://via.placeholder.com/300',
    caption: 'Perfect day for climbing!',
    location: 'Boulder Canyon',
    difficulty: '5.10a',
    timestamp: '2024-03-15T14:30:00Z',
    likes: 24,
    comments: 3,
  },
  {
    id: '2',
    imageUrl: 'https://via.placeholder.com/300',
    caption: 'Finally sent my project!',
    location: 'Red Rocks',
    difficulty: 'V4',
    timestamp: '2024-03-14T18:20:00Z',
    likes: 45,
    comments: 5,
  },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, token, signOut, refreshUserStats } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [localToken, setLocalToken] = useState<string | null>(null);

  // Log authentication state for debugging
  useEffect(() => {
    console.log('Profile screen - Auth state:', { 
      user: user ? user.username : 'null',
      isAuthenticated: !!token,
      token: token ? `${token.substring(0, 10)}...` : 'null'
    });
    
    // Attempt to get token from AsyncStorage as a fallback
    checkTokenFromStorage();
  }, [user, token]);
  
  // Fallback function to check token directly in AsyncStorage
  const checkTokenFromStorage = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      console.log('Token from AsyncStorage:', storedToken ? 'exists' : 'null');
      setLocalToken(storedToken);
    } catch (err) {
      console.error('Error reading token from AsyncStorage:', err);
    }
  };

  const loadPosts = async () => {
    try {
      console.log('loadPosts - Current token state:', { 
        contextToken: !!token,
        localToken: !!localToken
      });
      
      setIsLoading(true);
      setLoadingError(null);
      
      // Use token from context or fallback to localToken from AsyncStorage
      const authToken = token || localToken;
      
      // Check if any token is available
      if (!authToken) {
        console.error('loadPosts - No token available');
        setLoadingError('You need to be logged in');
        setIsLoading(false);
        
        // Try refreshing the token again
        await checkTokenFromStorage();
        return;
      }
      
      console.log('loadPosts - Fetching posts with token');
      const data = await api.getPosts(authToken);
      console.log('Loaded posts:', data);
      
      // Clear any error and update posts
      setLoadingError(null);
      setPosts(data);
    } catch (err) {
      console.error('Error loading posts:', err);
      setLoadingError('Failed to load posts');
    } finally {
      setIsLoading(false);
    }
  };

  // Load posts when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('Profile screen focused - Loading posts');
      loadPosts();
      
      // Refresh user stats when the screen is focused
      if (token) {
        console.log('Profile screen focused - Refreshing user stats');
        refreshUserStats();
      }
    }, [token, localToken]) // Add token and localToken as dependencies
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleSignOut = async () => {
    console.log('Sign out button pressed');
    try {
      console.log('Directly calling signOut function...');
      setIsLoading(true);
      await signOut();
      console.log('Sign out function completed');
      
      // Manual navigation as a fallback
      console.log('Manual navigation to login...');
      setTimeout(() => {
        router.push({
          pathname: '/auth/login',
        });
      }, 300);
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToFollowers = () => {
    if (!user) return;
    console.log('User data:', user);
    console.log('Followers count:', user?.stats?.followers);
    console.log('Following count:', user?.stats?.following);
    router.push(`/profile/followers?id=${user._id}`);
  };

  const navigateToFollowing = () => {
    if (!user) return;
    console.log('User data:', user);
    console.log('Followers count:', user?.stats?.followers);
    console.log('Following count:', user?.stats?.following);
    router.push(`/profile/following?id=${user._id}`);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.profileHeader}>
          <Image
            source={{ uri: user?.avatar_url || 'https://via.placeholder.com/100' }}
            style={styles.profileImage}
          />
          <View style={styles.userInfo}>
            <Text style={styles.username}>{user?.username || 'Climber'}</Text>
            <Text style={styles.bio}>{user?.bio || 'Rock climbing enthusiast'}</Text>
            
            {/* Display Climbing Gyms - Handle both formats */}
            {((user?.climbing_gyms && user.climbing_gyms.length > 0) || 
              (user?.climbing_gym_ids && user.climbing_gym_ids.length > 0)) && (
              <View style={styles.gymsContainer}>
                <Ionicons name="barbell-outline" size={14} color="#666" style={styles.gymIcon} />
                <Text style={styles.gymsText}>
                  {user?.climbing_gyms && user.climbing_gyms.length > 0 
                    ? user.climbing_gyms.map(gym => gym.name).join(', ')
                    : 'Member of climbing gym'}
                </Text>
              </View>
            )}
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => router.push('/profile/edit')}
              >
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.signOutButton} 
                onPress={handleSignOut}
                disabled={isLoading}
              >
                <>
                  <Ionicons name="log-out-outline" size={16} color="#4E6E5D" />
                  <Text style={styles.signOutButtonText}>Sign Out</Text>
                </>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        
        {/* Stats Row */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{user?.stats?.posts || 0}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <TouchableOpacity style={styles.statItem} onPress={navigateToFollowers}>
            <Text style={styles.statNumber}>{user?.stats?.followers || 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statItem} onPress={navigateToFollowing}>
            <Text style={styles.statNumber}>{user?.stats?.following || 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Posts Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Climbing Posts</Text>
          <TouchableOpacity 
            style={styles.refreshButton} 
            onPress={loadPosts}
            disabled={isLoading}
          >
            <Ionicons name="refresh" size={20} color="#4E6E5D" />
          </TouchableOpacity>
        </View>
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4E6E5D" />
          </View>
        ) : loadingError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{loadingError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadPosts}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.postsContainer}>
            {posts.length > 0 ? (
              posts.map((post) => (
                <View key={post._id} style={styles.postCard}>
                  <Image source={{ uri: post.image_url }} style={styles.postImage} />
                  <View style={styles.postInfo}>
                    <Text style={styles.postCaption}>{post.caption}</Text>
                    <View style={styles.postDetails}>
                      <Text style={styles.postLocation}>{post.location}</Text>
                      <Text style={styles.postDifficulty}>Grade: {post.difficulty}</Text>
                    </View>
                    <Text style={styles.postDate}>{formatDate(post.timestamp)}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No posts yet</Text>
                <TouchableOpacity 
                  style={styles.addPostButton}
                  onPress={() => router.push('/post')}
                >
                  <Text style={styles.addPostButtonText}>Add Your First Post</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
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
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#333',
    marginBottom: 4,
  },
  bio: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    marginBottom: 4,
  },
  gymsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  gymIcon: {
    marginRight: 4,
  },
  gymsText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    flexShrink: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  editButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#333',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4E6E5D',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  signOutButtonText: {
    color: '#4E6E5D',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    marginLeft: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#666',
  },
  section: {
    padding: 16,
    backgroundColor: '#fff',
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#333',
  },
  refreshButton: {
    padding: 8,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    color: '#4E6E5D',
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#4E6E5D',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
    fontFamily: 'Inter_500Medium',
  },
  postsContainer: {
    marginTop: 8,
  },
  postCard: {
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  postImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  postInfo: {
    padding: 12,
  },
  postCaption: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#333',
    marginBottom: 8,
  },
  postDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  postLocation: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#666',
  },
  postDifficulty: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#4E6E5D',
  },
  postDate: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#999',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    marginBottom: 12,
  },
  addPostButton: {
    backgroundColor: '#4E6E5D',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  addPostButtonText: {
    color: '#fff',
    fontFamily: 'Inter_500Medium',
  },
});
