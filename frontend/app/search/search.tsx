import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import SearchBox from '../../components/SearchBox';
import { api, UserPublic as ApiUserPublic } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

// Extend the UserPublic type from the API to include the new field
interface UserPublic extends ApiUserPublic {
  climbing_gym_names?: string[];
}

export default function SearchScreen() {
  const router = useRouter();
  const { token, refreshUserStats } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserPublic[]>([]);
  const [searching, setSearching] = useState(false);
  const [followLoading, setFollowLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // Search for users when query changes
  useEffect(() => {
    const delayTimer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchUsers(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 500); // Debounce search for 500ms

    return () => clearTimeout(delayTimer);
  }, [searchQuery, token]);

  // Reset search on focus
  useFocusEffect(
    useCallback(() => {
      setSearchQuery('');
      setSearchResults([]);
    }, [])
  );

  const searchUsers = async (query: string) => {
    if (!token) return;

    try {
      setSearching(true);
      setError(null);
      const results = await api.searchUsers(token, query);
      setSearchResults(results);
    } catch (err: any) {
      console.error('Error searching users:', err);
      setError('Failed to search users. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleFollowToggle = async (user: UserPublic) => {
    if (!token) return;

    try {
      setFollowLoading(prev => ({ ...prev, [user._id]: true }));
      
      let result;
      if (user.is_following) {
        result = await api.unfollowUser(token, user._id);
      } else {
        result = await api.followUser(token, user._id);
      }
      
      // Update the search results with the new follow status
      setSearchResults(prev => 
        prev.map(u => 
          u._id === user._id 
            ? { ...u, is_following: !u.is_following } 
            : u
        )
      );
      
      // If we got updated stats, refresh the current user profile
      if (result.updated_stats) {
        await refreshUserStats();
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
    } finally {
      setFollowLoading(prev => ({ ...prev, [user._id]: false }));
    }
  };

  const handleProfilePress = (userId: string) => {
    router.push(`/profile/${userId}`);
  };

  const renderUserCard = ({ item }: { item: UserPublic }) => (
    <View style={styles.userCard}>
      <TouchableOpacity 
        style={styles.userInfoContainer}
        onPress={() => handleProfilePress(item._id)}
      >
        <Image 
          source={item.avatar_url ? { uri: item.avatar_url } : require('../../assets/images/default-avatar.jpg')} 
          style={styles.profileImage} 
        />
        <View style={styles.userDetails}>
          <Text style={styles.name}>{item.username}</Text>
          {/* Add bio below username */}
          {item.bio && (
            <Text style={styles.bio} numberOfLines={1}> 
              {item.bio}
            </Text>
          )}
          {/* Display only the first gym name if available */}
          {item.climbing_gym_names && item.climbing_gym_names.length > 0 && (
            <Text style={styles.gymNames} numberOfLines={1}>
              {item.climbing_gym_names[0]}
            </Text>
          )}
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

  return (
    <View style={styles.container}>
      <SearchBox
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search by username or location..."
      />
      
      {searching ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4E6E5D" />
          <Text style={styles.searchingText}>Searching...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={40} color="#4E6E5D" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={searchResults}
          renderItem={renderUserCard}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            searchQuery.length >= 2 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No users found</Text>
              </View>
            ) : searchQuery.length > 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Type at least 2 characters to search</Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Search for climbers by username or location</Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingLeft: 16,
    paddingRight: 16,
    paddingVertical: 18,
    backgroundColor: 'white',
    borderBottomColor: '#f0f0f0',
    borderBottomWidth: 1,
    width: '100%',
    height: 56,
    zIndex: 10, // Ensure it stays on top
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: 'white',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: '#000',
    marginLeft: 16,
  },
  backButton: {
    padding: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  searchingText: {
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
    textAlign: 'center',
  },
  listContainer: {
    paddingHorizontal: 2,
    paddingVertical: 12,
  },
  userCard: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
    alignItems: 'center',
  },
  userInfoContainer: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
    marginRight: 8,
  },
  profileImage: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#262626',
    marginBottom: 3,
  },
  gymNames: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    flexShrink: 1,
    marginTop: 2, // Add margin above gym names if bio is present
  },
  bio: { // Add style for bio
    fontSize: 13,
    fontFamily: 'Inter_500Medium', // Make it slightly thicker (Medium)
    color: '#444', // Slightly darker than gym names
    marginBottom: 3, // Space below bio if gym names are present
    flexShrink: 1,
  },
  followButton: {
    backgroundColor: '#4E6E5D',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  followButtonText: {
    fontSize: 13,
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