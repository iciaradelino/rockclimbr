import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import SearchBox from '../../components/SearchBox';
import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api, Post as ApiPost } from '@/services/api'; // Renamed Post to ApiPost to avoid conflict
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants'; // Import Constants

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

const PostCard = ({ post }: { post: ApiPost }) => {
  // Log the post data, excluding potentially long URLs - REMOVED
  // const { image_url, avatar_url, ...restOfPost } = post;
  // console.log('Rendering PostCard with post (URLs omitted):', JSON.stringify(restOfPost, null, 2));
  
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
            source={post.avatar_url ? { uri: post.avatar_url } : require('../../assets/images/default-avatar.jpg')}
            style={styles.avatar} 
          />
          <View style={styles.textContainer}>
            <Text style={styles.username}>{post.username || 'Unknown User'}</Text> {/* Use username */}
            <Text style={styles.location} numberOfLines={1}>{post.location || ''}</Text> {/* Use location */}
          </View>
        </View>
        {/* Add more icons or options here if needed */}
      </TouchableOpacity>
      <Image
        source={{ uri: post.image_url }} // Use image_url
        style={styles.postImage}
        resizeMode="cover" // Move resizeMode to props
      />
      <View style={styles.postFooter}>
        <View style={styles.interactionButtons}>
          {/* Add Like button here later */}
          <TouchableOpacity style={styles.iconButton}>
            <>
              <Ionicons name="chatbubble-outline" size={24} color="#666" />
              <Text style={styles.commentCount}>{String(post.comments ?? 0)}</Text> {/* Use comments, ensuring it's a string */}
            </>
          </TouchableOpacity>
          {/* Add Share/Save buttons here later */}
        </View>
        <TouchableOpacity onPress={handleProfilePress} style={styles.descriptionContainer}>
          <Text style={styles.username}>{post.username || 'Unknown User'}</Text> {/* Use username */}
          <Text style={styles.description}>{post.caption || ''}</Text> {/* Use caption */}
        </TouchableOpacity>
        <Text style={styles.difficulty}>Grade: {post.difficulty || 'N/A'}</Text> {/* Use difficulty */}
        {post.timestamp ? (
          <Text style={styles.timestamp}>{new Date(post.timestamp).toLocaleDateString()}</Text> /* Display timestamp */
        ) : null}
      </View>
    </View>
  );
};


export default function ExploreScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
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
      
      // Filter out posts where the user_id matches the current user's _id
      const currentUserId = user?._id;
      const filteredPosts = currentUserId 
        ? feedPosts.filter(post => post.user_id !== currentUserId)
        : feedPosts; // If user is somehow null, show all posts (or handle as needed)

      setPosts(filteredPosts); // Set the filtered posts
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
  }, [token, user]); // Add user to dependency array

  // Load feed when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadFeed();
    }, [loadFeed])
  );

  // Also load feed on initial mount or when token changes
  useEffect(() => {
    loadFeed();
  }, [token]); // Dependency on token ensures reload on login/logout

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFeed(true);
  }, [loadFeed]);

  return (
    <View style={styles.container}>
      <StatusBar style="auto" translucent={true} />
      
      {isLoading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#4E6E5D" />
        </View>
      ) : error ? (
        <View style={styles.emptyContainer}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => loadFeed()}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={posts}
          renderItem={({ item }) => <PostCard post={item} />}
          keyExtractor={item => item._id || Math.random().toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <TouchableOpacity 
              style={styles.searchContainer}
              onPress={() => router.push('/search')}
            >
              <View style={styles.searchBoxWrapper}>
                <SearchBox
                  value=""
                  onChangeText={() => {}}
                  placeholder="Search climbers..."
                  editable={false}
                />
              </View>
            </TouchableOpacity>
          }
          ListEmptyComponent={
            posts.length === 0 && !isLoading && !error ? (
              <View style={styles.emptyComponentContainer}>
                <Text style={styles.emptyText}>Your feed is empty. Follow some climbers or add your first post!</Text>
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#4E6E5D']}
            />
          }
        />
      )}
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
  searchContainer: {
    paddingLeft: 0,
    paddingRight: 0,
    backgroundColor: 'white',
    width: '100%',
    height: 56,
    marginTop: 8, // Add margin below the search container
    marginBottom: 6, // Add margin below the search container

  },
  searchBoxWrapper: {
    flex: 1,
    marginHorizontal: 16,
  },
  postCard: {
    marginHorizontal: 16,
    marginBottom: 20, // Increased bottom margin
    backgroundColor: '#fff',
    borderRadius: 12,
    // Use boxShadow for web/iOS, keep elevation for Android
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)', // Equivalent boxShadow
    elevation: 3, // Android shadow
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 0,
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
  emptyComponentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});
