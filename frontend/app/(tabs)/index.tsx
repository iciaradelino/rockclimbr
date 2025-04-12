import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import SearchBox from '../../components/SearchBox';
import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api, Post as ApiPost } from '@/services/api'; // Renamed Post to ApiPost to avoid conflict

// Update Post interface to match the one from api.ts
// Note: We use ApiPost from api.ts now, so this local interface might be removed or adjusted.
// Let's keep it for PostCard props for now, but ensure consistency.
interface PostCardProps {
  _id?: string;
  username: string; // From user object joined in backend
  location: string; // post location
  image_url: string; // post image
  caption: string; // post caption
  difficulty: string; // post difficulty
  likes: number;
  comments: number;
  avatar_url: string; // From user object joined in backend
  timestamp: string; // Added timestamp
}

const DUMMY_POSTS: PostCardProps[] = [
  // ... Keep dummy data for reference or initial state if needed, but it won't be used for display.
  // Or remove it entirely if not needed. Let's remove it for clarity.
];

const PostCard = ({ post }: { post: ApiPost }) => {
  const router = useRouter();
  const handleProfilePress = () => {
    if (post.user_id) {
      router.push(`/profile/${post.user_id}`);
    }
  };

  return (
    <View style={styles.postCard}>
      <TouchableOpacity onPress={handleProfilePress} style={styles.postHeader}>
        <View style={styles.userInfo}>
          <Image 
            source={{ uri: post.avatar_url || 'https://via.placeholder.com/50' }} // Use avatar_url, provide fallback
            style={styles.avatar} 
          />
          <View style={styles.textContainer}>
            <Text style={styles.username}>{post.username || 'Unknown User'}</Text> {/* Use username */}
            <Text style={styles.location} numberOfLines={1}>{post.location}</Text> {/* Use location */}
          </View>
        </View>
        {/* Add more icons or options here if needed */}
      </TouchableOpacity>
      <Image
        source={{ uri: post.image_url }} // Use image_url
        style={styles.postImage}
      />
      <View style={styles.postFooter}>
        <View style={styles.interactionButtons}>
          {/* Add Like button here later */}
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="chatbubble-outline" size={24} color="#666" />
            <Text style={styles.commentCount}>{post.comments || 0}</Text> {/* Use comments */}
          </TouchableOpacity>
          {/* Add Share/Save buttons here later */}
        </View>
        <TouchableOpacity onPress={handleProfilePress} style={styles.descriptionContainer}>
          <Text style={styles.username}>{post.username || 'Unknown User'}</Text> {/* Use username */}
          <Text style={styles.description}>{post.caption}</Text> {/* Use caption */}
        </TouchableOpacity>
        <Text style={styles.difficulty}>Grade: {post.difficulty}</Text> {/* Use difficulty */}
        <Text style={styles.timestamp}>{new Date(post.timestamp).toLocaleDateString()}</Text> {/* Display timestamp */}
      </View>
    </View>
  );
};


export default function ExploreScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadFeed = useCallback(async (isRefreshing = false) => {
    if (!token) {
      setError("Please log in to see your feed.");
      setIsLoading(false);
      if (isRefreshing) setRefreshing(false);
      return;
    }
    
    if (!isRefreshing) setIsLoading(true);
    setError(null);

    try {
      const feedPosts = await api.getFeed(token);
      console.log('Feed posts received from API:', JSON.stringify(feedPosts, null, 2)); // Log the received data
      setPosts(feedPosts);
    } catch (err: any) {
      console.error('Error loading feed:', err);
      setError(err.message || 'Failed to load feed. Please try again.');
    } finally {
      if (isRefreshing) {
        setRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [token]);

  // Load feed when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log("Explore screen focused, loading feed.");
      loadFeed();
    }, [loadFeed])
  );

  // Also load feed on initial mount or when token changes
  useEffect(() => {
    console.log("Token changed or initial mount, loading feed.");
    loadFeed();
  }, [token]); // Dependency on token ensures reload on login/logout

  const onRefresh = useCallback(() => {
    console.log("Pull to refresh triggered.");
    setRefreshing(true);
    loadFeed(true);
  }, [loadFeed]);

  const ListHeader = () => (
    <TouchableOpacity 
      style={styles.searchContainer}
      onPress={() => router.push('/search')}
    >
      <SearchBox
        value=""
        onChangeText={() => {}} // No-op as it's not editable
        placeholder="Search climbers..."
        editable={false} // Keep it non-editable, links to search page
      />
    </TouchableOpacity>
  );

  const renderListEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      {isLoading ? (
        <ActivityIndicator size="large" color="#4E6E5D" />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadFeed()}>
             <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.emptyText}>Your feed is empty. Follow some climbers or add your first post!</Text>
        // Optionally add buttons to search users or add post
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        renderItem={({ item }) => <PostCard post={item} />}
        keyExtractor={item => item._id || Math.random().toString()} // Use _id from API post
        showsVerticalScrollIndicator={false}
        contentContainerStyle={posts.length === 0 ? styles.emptyListContent : styles.listContent}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={renderListEmptyComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4E6E5D']} // Customize spinner color
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 16, // Add padding at the bottom
  },
  emptyListContent: {
    flexGrow: 1, // Make empty container take full height
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingLeft: 2, // Add horizontal padding
    paddingRight: 2, // Add horizontal padding
    paddingVertical: 8,
    backgroundColor: 'white',
    // Removed marginBottom to let FlatList handle spacing
    borderBottomColor: '#f0f0f0', // Optional: separator color
  },
  postCard: {
    marginHorizontal: 16,
    marginBottom: 20, // Increased bottom margin
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2, // Adjusted shadow offset
    },
    shadowOpacity: 0.1, // Reduced shadow opacity
    shadowRadius: 8, // Adjusted shadow radius
    elevation: 3, // Adjusted elevation
    overflow: 'visible', // Allow shadow to be visible
  },
  postHeader: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // Removed borderBottom
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1, // Ensure userInfo takes available horizontal space
  },
  avatar: {
    width: 40, // Slightly larger avatar
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1, // Add border to avatar
    borderColor: '#eee', // Avatar border color
  },
  textContainer: {
    flex: 1,
    marginLeft: 10,
  },
  username: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15, // Slightly larger username
    color: '#262626', // Darker username color
  },
  location: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#666',
    flexShrink: 1, // Allow text to shrink if container is too small
  },
  postImage: {
    width: '100%',
    height: 400, // Keep image height or make dynamic
    resizeMode: 'cover',
    // Consider adding backgroundColor for placeholders while loading
    backgroundColor: '#f0f0f0',
  },
  postFooter: {
    paddingHorizontal: 16, // Consistent horizontal padding
    paddingTop: 12,
    paddingBottom: 12,
    // Removed borderTop
  },
  interactionButtons: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  commentCount: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    marginLeft: 5, // Increased margin
    color: '#666', // Match icon color
  },
  descriptionContainer: {
    flexDirection: 'row',
    marginBottom: 6, // Reduced margin
    alignItems: 'center', // Align username and caption
  },
  description: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#333',
    marginLeft: 5, // Consistent margin
    flexShrink: 1, // Allow description to wrap
  },
  difficulty: {
    fontFamily: 'Inter_600SemiBold',
    color: '#4E6E5D',
    fontSize: 13, // Slightly smaller
    marginBottom: 4, // Add margin below difficulty
  },
  timestamp: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11, // Smaller timestamp
    color: '#999', // Lighter color for timestamp
    marginTop: 4, // Add margin above timestamp
  },
  emptyContainer: {
    flex: 1, // Ensure it takes space
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 50, // Add some margin from the header
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorContainer: {
     alignItems: 'center',
     padding: 20,
  },
  errorText: {
    color: '#D83C3C', // Error color
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
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
  },
});
