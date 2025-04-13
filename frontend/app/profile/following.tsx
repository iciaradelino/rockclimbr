import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import { api, UserPublic } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

export default function FollowingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [following, setFollowing] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followLoading, setFollowLoading] = useState<Record<string, boolean>>({});

  console.log(`[${new Date().toISOString()}] FollowingScreen loaded. ID from searchParams: ${id}`);

  useEffect(() => {
    console.log(`[${new Date().toISOString()}] FollowingScreen useEffect. ID: ${id}, Token: ${token ? 'exists' : 'missing'}`);
    if (token && id) {
      loadFollowing();
    }
  }, [token, id]);

  const loadFollowing = async () => {
    console.log(`[${new Date().toISOString()}] loadFollowing called. ID: ${id}, Token: ${token ? 'exists' : 'missing'}`);
    if (!token || !id) {
      console.error("LoadFollowing called without token or id. Aborting.");
      setError("User ID is missing");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await api.getFollowing(token as string, id as string);
      setFollowing(data);
    } catch (err: any) {
      console.error('Error loading following:', err);
      setError(err.message || 'Failed to load following');
    } finally {
      setLoading(false);
    }
  };

  const handleProfilePress = (userId: string) => {
    router.push(`/profile/${userId}`);
  };

  const handleFollowToggle = async (user: UserPublic) => {
    try {
      setFollowLoading(prev => ({ ...prev, [user._id]: true }));
      
      if (user.is_following) {
        await api.unfollowUser(token as string, user._id);
      } else {
        await api.followUser(token as string, user._id);
      }
      
      // Update the following list with the new follow status
      setFollowing(prev => 
        prev.map(u => 
          u._id === user._id 
            ? { ...u, is_following: !u.is_following } 
            : u
        )
      );
    } catch (err) {
      console.error('Error toggling follow:', err);
    } finally {
      setFollowLoading(prev => ({ ...prev, [user._id]: false }));
    }
  };

  const renderFollowingItem = ({ item }: { item: UserPublic }) => (
    <View style={styles.followingItem}>
      <TouchableOpacity 
        style={styles.userInfo}
        onPress={() => handleProfilePress(item._id)}
      >
        <Image 
          source={{ uri: item.avatar_url || 'https://via.placeholder.com/40' }} 
          style={styles.avatar} 
        />
        <View style={styles.userDetails}>
          <Text style={styles.username}>{item.username}</Text>
          <Text style={styles.bio} numberOfLines={1}>{item.bio || ''}</Text>
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[
          styles.followButton, 
          item.is_following && styles.followingButton
        ]}
        onPress={() => handleFollowToggle(item)}
        disabled={followLoading[item._id]}
      >
        {followLoading[item._id] ? (
          <ActivityIndicator size="small" color={item.is_following ? '#666' : '#fff'} />
        ) : (
          <Text style={[
            styles.followButtonText,
            item.is_following && styles.followingButtonText
          ]}>
            {item.is_following ? 'Following' : 'Follow'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4E6E5D" />
        <Text style={styles.loadingText}>Loading following...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={40} color="#4E6E5D" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadFollowing}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={following}
        renderItem={renderFollowingItem}
        keyExtractor={item => item._id}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Not following anyone yet</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#4E6E5D',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
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
  listContent: {
    padding: 16,
  },
  followingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#333',
    marginBottom: 2,
  },
  bio: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#666',
  },
  followButton: {
    backgroundColor: '#4E6E5D',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  followButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#fff',
  },
  followingButtonText: {
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    textAlign: 'center',
  },
}); 