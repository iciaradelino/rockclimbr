import { Platform } from 'react-native';
import { ObjectId } from 'bson'; // May need to install bson: npm install bson @types/bson

// --- IMPORTANT ---
// Replace 'YOUR_COMPUTER_LOCAL_IP' with your computer's actual local network IP address.
// Find it using 'ipconfig' (Windows) or 'ifconfig'/'ip addr' (macOS/Linux).
const YOUR_COMPUTER_LOCAL_IP = '192.168.1.58'; 
// ---------------

// Update to handle different environments
const API_URL = Platform.OS === 'web' 
  ? 'http://localhost:5000/api' 
  : `http://${YOUR_COMPUTER_LOCAL_IP}:5000/api`; // For native builds (iOS/Android simulators and physical devices)

export interface Climb {
  route_name: string;
  grade: string;
  attempts: number;
  send_status: string;
  notes?: string;
}

export interface Workout {
  _id?: string;
  date: string;
  duration: number;
  location: string;
  climbs: Climb[];
  session_feeling?: string;
  achievement?: string;
  images: string[];
}

export interface Post {
  _id?: string;
  user_id: string;
  image_url: string;
  caption: string;
  location?: string;
  gym_id?: string;
  difficulty: string;
  timestamp: string;
  likes: number;
  comments: number;
  username?: string;
  avatar_url?: string;
}

export interface Gym {
  id: string; // Corresponds to _id from backend
  name: string;
  location?: string;
  franchise?: string; // Add optional franchise
}

export interface User {
  _id: string;
  username: string;
  email: string;
  bio?: string;
  location?: string;
  avatar_url?: string;
  climbing_gyms?: Gym[]; // Array of Gym objects
  climbing_gym_ids?: string[]; // Array of gym IDs from backend
  created_at: string;
  stats: {
    posts: number;
    followers: number;
    following: number;
  };
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface UserProfile {
  _id: string;
  username: string;
  bio?: string;
  location?: string;
  avatar_url?: string;
  climbing_gyms?: Gym[]; // Now expects array of Gym objects
  stats: {
    posts: number;
    followers: number;
    following: number;
  };
  is_following: boolean;
  is_self: boolean;
  posts: Post[];
}

export interface UserPublic {
  _id: string;
  username: string;
  bio?: string;
  location?: string;
  avatar_url?: string;
  stats: {
    posts: number;
    followers: number;
    following: number;
  };
  is_following: boolean;
  created_at?: string;
}

class ApiError extends Error {
  constructor(public response: any) {
    super(response?.error || 'An error occurred');
    this.name = 'ApiError';
  }
}

// Helper function for API requests with better error handling
const fetchWithErrorHandling = async (url: string, options: RequestInit) => {
  try {
    console.log(`API Request to: ${url}`);
    
    // Don't use credentials for web requests to avoid CORS issues
    const corsOptions: RequestInit = Platform.OS === 'web' 
      ? { mode: 'cors' as RequestMode } // For web, don't include credentials 
      : { credentials: 'include', mode: 'cors' as RequestMode }; // For native, include credentials
    
    const response = await fetch(url, {
      ...options,
      ...corsOptions,
    });
    
    // For non-JSON responses or errors
    if (!response.ok) {
      try {
        const errorData = await response.json();
        console.error('API Error Response:', errorData);
        throw new ApiError(errorData);
      } catch (jsonError) {
        // If response is not JSON
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
    }
    
    // For successful responses
    try {
      const data = await response.json();
      return data;
    } catch (jsonError) {
      console.error('Error parsing JSON response:', jsonError);
      throw new Error('Invalid response format from server');
    }
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

export const api = {
  // Auth endpoints
  register: async (data: {
    username: string;
    email: string;
    password: string;
    bio?: string;
    location?: string;
    avatar_url?: string;
  }): Promise<AuthResponse> => {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('Registration error:', responseData);
        throw new ApiError(responseData);
      }
      
      return responseData;
    } catch (error) {
      console.error('Error registering:', error);
      throw error;
    }
  },

  login: async (data: { email: string; password: string }): Promise<AuthResponse> => {
    try {
      console.log('API login - Attempting to login with:', data.email);
      console.log('API login - Sending request to:', `${API_URL}/auth/login`);
      
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      console.log('API login - Response status:', response.status);
      const responseData = await response.json();
      console.log('API login - Response data received');
      
      if (!response.ok) {
        console.error('API login - Login error:', responseData);
        throw new ApiError(responseData);
      }
      
      console.log('API login - Login successful');
      return responseData;
    } catch (error) {
      console.error('API login - Error logging in:', error);
      throw error;
    }
  },

  getCurrentUser: async (token: string): Promise<User> => {
    try {
      console.log('Fetching current user data with token:', token?.substring(0, 10) + '...');
      
      // For web platform, use regular fetch without credentials
      if (Platform.OS === 'web') {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new ApiError(data);
        }
        
        return data;
      } else {
        // For native platforms, use fetchWithErrorHandling
        return await fetchWithErrorHandling(`${API_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });
      }
    } catch (error) {
      console.error('Error getting current user:', error);
      throw error;
    }
  },

  updateProfile: async (token: string, data: Partial<User> & { climbing_gym_ids?: string[] }): Promise<User> => {
    try {
      // We only send changed fields + climbing_gym_ids if present
      console.log('API updateProfile - Sending data:', JSON.stringify(data)); 
      const response = await fetch(`${API_URL}/auth/me/profile`, { // Ensure this matches backend route
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const responseData = await response.json();
      if (!response.ok) {
          // The backend now returns { message: ..., user: ... } on success
          // Need to adjust error handling if error structure changed
          throw new ApiError(responseData);
      }
      // Adjust based on actual successful response structure from backend PUT
      // Assuming backend returns { message: ..., user: ... } on success
      if (responseData.user) {
          return responseData.user; 
      } else {
          // Fallback or fetch user again if PUT doesn't return full user
          console.warn("Profile update response did not contain user data, fetching again.");
          return await api.getCurrentUser(token); 
      }
      
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  },

  // Get all workouts
  getWorkouts: async (token: string): Promise<Workout[]> => {
    try {
      const response = await fetch(`${API_URL}/workouts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new ApiError(data);
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching workouts:', error);
      throw error;
    }
  },

  // Add a new workout
  addWorkout: async (token: string, workout: Omit<Workout, '_id'>): Promise<{ id: string }> => {
    try {
      const response = await fetch(`${API_URL}/workouts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workout),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new ApiError(data);
      }
      
      return data;
    } catch (error) {
      console.error('Error adding workout:', error);
      throw error;
    }
  },

  // Get a specific workout by ID
  getWorkout: async (token: string, id: string): Promise<Workout> => {
    try {
      const response = await fetch(`${API_URL}/workouts/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new ApiError(data);
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching workout:', error);
      throw error;
    }
  },

  // Get all posts
  getPosts: async (token: string): Promise<Post[]> => {
    try {
      const response = await fetch(`${API_URL}/posts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new ApiError(data);
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching posts:', error);
      throw error;
    }
  },

  // Add a new post
  addPost: async (token: string, post: Omit<Post, '_id' | 'user_id' | 'likes' | 'comments'>): Promise<{ id: string }> => {
    try {
      const response = await fetch(`${API_URL}/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(post),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new ApiError(data);
      }
      
      return data;
    } catch (error) {
      console.error('Error adding post:', error);
      throw error;
    }
  },
  
  // Get feed (posts from followed users and self)
  getFeed: async (token: string): Promise<Post[]> => {
    try {
          console.log('Fetching feed data...');
      // Corrected URL
      const response = await fetchWithErrorHandling(`${API_URL}/posts/feed`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      console.log('Feed data received:', response);
      return response;
    } catch (error) {
      console.error('Error fetching feed:', error);
      throw error;
    }
  },
  
  // Get user profile
  getUserProfile: async (token: string, userId: string): Promise<UserProfile> => {
    try {
      const response = await fetch(`${API_URL}/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new ApiError(data);
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  },
  
  // Follow a user
  followUser: async (token: string, userId: string): Promise<{ message: string, updated_stats?: { following: number, followers: number } }> => {
    try {
      const response = await fetch(`${API_URL}/users/follow/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new ApiError(data);
      }
      
      return data;
    } catch (error) {
      console.error('Error following user:', error);
      throw error;
    }
  },
  
  // Unfollow a user
  unfollowUser: async (token: string, userId: string): Promise<{ message: string, updated_stats?: { following: number, followers: number } }> => {
    try {
      const response = await fetch(`${API_URL}/users/unfollow/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new ApiError(data);
      }
      
      return data;
    } catch (error) {
      console.error('Error unfollowing user:', error);
      throw error;
    }
  },
  
  // Get followers of a user
  getFollowers: async (token: string, userId: string): Promise<UserPublic[]> => {
    try {
      const response = await fetch(`${API_URL}/users/${userId}/followers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new ApiError(data);
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching followers:', error);
      throw error;
    }
  },
  
  // Get users that a user is following
  getFollowing: async (token: string, userId: string): Promise<UserPublic[]> => {
    try {
      const response = await fetch(`${API_URL}/users/${userId}/following`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new ApiError(data);
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching following:', error);
      throw error;
    }
  },
  
  // Search users
  searchUsers: async (token: string, query: string): Promise<UserPublic[]> => {
    try {
      const response = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new ApiError(data);
      }
      
      return data;
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  },

  // --- New Gym Functions ---
  searchGyms: async (token: string, query: string): Promise<Gym[]> => {
    try {
      const response = await fetch(`${API_URL}/gyms/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new ApiError(data);
      }
      return data;
    } catch (error) {
      console.error('Error searching gyms:', error);
      throw error;
    }
  },

  addGym: async (token: string, gymData: { name: string, location: string, franchise?: string }): Promise<Gym> => {
    try {
      const response = await fetch(`${API_URL}/gyms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gymData), // Send name, location, and optional franchise
      });
      const data = await response.json();
      if (!response.ok) {
        throw new ApiError(data);
      }
      return data; // Backend returns the created/found gym object
    } catch (error) {
      console.error('Error adding gym:', error);
      throw error;
    }
  },

  // Update user password
  updatePassword: async (token: string, passwordData: { current_password: string, new_password: string }): Promise<{ message: string }> => {
    try {
      const response = await fetch(`${API_URL}/auth/me/password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(passwordData),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new ApiError(data);
      }
      return data; // Expects { message: "..." }
    } catch (error) {
      console.error('Error updating password:', error);
      throw error;
    }
  },

  getBaseUrl: () => API_URL,

  deleteWorkout: async (token: string, id: string): Promise<void> => {
    try {
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      console.log(`Attempting to delete workout with ID: ${id}`);
      const url = `${API_URL}/workouts/${id}`;
      console.log(`DELETE request to: ${url}`);
      
      // For web platform, handle differently to avoid CORS issues
      const corsOptions: RequestInit = Platform.OS === 'web' 
        ? { mode: 'cors' as RequestMode } // For web, don't include credentials 
        : { credentials: 'include' as RequestCredentials, mode: 'cors' as RequestMode }; // For native, include credentials
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        ...corsOptions,
      });
      
      console.log(`DELETE response status: ${response.status}`);
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: `Failed with status: ${response.status}` };
        }
        console.error('Delete workout error response:', errorData);
        throw new ApiError(errorData);
      }
      
      console.log('Workout deleted successfully');
      return; // Explicitly return void
    } catch (error) {
      console.error('Error in deleteWorkout method:', error);
      throw error;
    }
  },
};

// Export a default component to satisfy Expo Router
export default function ApiExport() {
  return null;
} 