import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect, useCallback } from 'react';
import { api, UserProfile, Post } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user, refreshUserStats } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followLoading, setFollowLoading] = useState(false);

  const loadUserProfile = useCallback(async () => {
    if (!token || !id) return;

    try {
      setLoading(true);
      setError(null);
      const data = await api.getUserProfile(token, id);
      setProfile(data);
    } catch (err: any) {
      console.error('Error loading user profile:', err);
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);

  useFocusEffect(
    useCallback(() => {
      if (!loading) {
        loadUserProfile();
      }
      return () => {};
    }, [loadUserProfile])
  );

  const handleFollowToggle = async () => {
    if (!token || !profile || followLoading) return;

    try {
      setFollowLoading(true);
      let result;
      if (profile.is_following) {
        result = await api.unfollowUser(token, profile._id);
      } else {
        result = await api.followUser(token, profile._id);
      }

      if (result.updated_stats) {
        await refreshUserStats();
      }

      await loadUserProfile();
    } catch (err: any) {
      console.error('Error toggling follow:', err);
    } finally {
      setFollowLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const navigateToFollowers = () => {
    if (!profile) return;
    router.push(`/profile/followers?id=${profile._id}`);
  };

  const navigateToFollowing = () => {
    if (!profile) return;
    router.push(`/profile/following?id=${profile._id}`);
  };

  const navigateToEditProfile = () => {
      router.push('/profile/edit');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4E6E5D" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={40} color="#4E6E5D" />
        <Text style={styles.errorText}>{error || 'Profile not found'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadUserProfile}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.profileHeader}>
          <Image
            source={{ uri: profile.avatar_url || 'https://via.placeholder.com/100' }}
            style={styles.profileImage}
          />
          <View style={styles.userInfo}>
            <Text style={styles.username}>{profile.username}</Text>
            <Text style={styles.bio}>{profile.bio || 'No bio yet'}</Text>
            <Text style={styles.location}>{profile.location || ''}</Text>
            {profile.climbing_gyms && profile.climbing_gyms.length > 0 && (
              <View style={styles.gymsContainer}>
                <Ionicons name="barbell-outline" size={14} color="#666" style={styles.gymIcon} />
                <Text style={styles.gymsText}>
                  {profile.climbing_gyms.map(gym => gym.name).join(', ')}
                </Text>
              </View>
            )}
            
            {profile.is_self ? (
              <TouchableOpacity style={styles.editButton} onPress={navigateToEditProfile}>
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[
                  styles.followButton, 
                  profile.is_following && styles.followingButton
                ]}
                onPress={handleFollowToggle}
                disabled={followLoading}
              >
                {followLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.followButtonText}>
                    {profile.is_following ? 'Following' : 'Follow'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{profile.stats.posts}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <TouchableOpacity style={styles.statItem} onPress={navigateToFollowers}>
            <Text style={styles.statNumber}>{profile.stats.followers}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statItem} onPress={navigateToFollowing}>
            <Text style={styles.statNumber}>{profile.stats.following}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {profile.is_self ? 'My Climbing Posts' : `${profile.username}'s Posts`}
          </Text>
          <TouchableOpacity 
            style={styles.refreshButton} 
            onPress={loadUserProfile}
            disabled={loading}
          >
            <Ionicons name="refresh" size={20} color="#4E6E5D" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.postsContainer}>
          {profile.posts.length > 0 ? (
            profile.posts.map((post: Post) => (
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
              {profile.is_self && (
                <TouchableOpacity 
                  style={styles.addPostButton}
                  onPress={() => router.push('/post')}
                >
                  <Text style={styles.addPostButtonText}>Add Your First Post</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#4E6E5D',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 20,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
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
    fontSize: 14,
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
    color: '#888',
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
  editButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  editButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#333',
  },
  followButton: {
    backgroundColor: '#4E6E5D',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  followingButton: {
    backgroundColor: '#ddd',
  },
  followButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#fff',
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