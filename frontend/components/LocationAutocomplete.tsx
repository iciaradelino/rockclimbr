import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  Pressable,
  Platform,
  useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { debounce } from 'lodash';

// Interface for location suggestion results
interface LocationSuggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface LocationAutocompleteProps {
  value: string;
  onLocationSelect: (location: string) => void;
  placeholder?: string;
  inputStyle?: object;
}

export default function LocationAutocomplete({
  value,
  onLocationSelect,
  placeholder = 'Add location',
  inputStyle = {}
}: LocationAutocompleteProps) {
  const [searchQuery, setSearchQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputHeight, setInputHeight] = useState(0);
  const inputRef = useRef<View>(null);
  const { width } = useWindowDimensions();
  
  // Update the search query when the value prop changes
  useEffect(() => {
    setSearchQuery(value);
  }, [value]);
  
  // Set up a click handler to close suggestions when clicking outside
  useEffect(() => {
    const handleOutsideClick = () => {
      if (showSuggestions) {
        setShowSuggestions(false);
      }
    };

    // For React Native Web only
    if (typeof document !== 'undefined') {
      document.addEventListener('click', handleOutsideClick);
      return () => {
        document.removeEventListener('click', handleOutsideClick);
      };
    }
  }, [showSuggestions]);
  
  // Ref for debounce function to prevent memory leaks
  const debouncedSearch = useRef(
    debounce(async (query: string) => {
      if (query.length < 3) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Add a brief delay between API calls to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            query
          )}&limit=5&addressdetails=1`,
          {
            headers: {
              // Nominatim requires a valid user agent with contact information
              'User-Agent': 'RockClimbingApp/1.0 (contact@rockclimbingapp.com)',
              'Accept-Language': 'en-US,en;q=0.9',
              'Referer': 'https://rockclimbingapp.com'
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Network response error: ${response.status}`);
        }

        const results = await response.json();
        setSuggestions(results);
      } catch (err) {
        console.error('Error fetching location suggestions:', err);
        setError('Failed to load suggestions');
      } finally {
        setLoading(false);
      }
    }, 500)
  ).current;

  // Clean up the debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  // Handle search query changes
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    onLocationSelect(text); // Update parent component with current text
    setShowSuggestions(true);
    debouncedSearch(text);
  };

  // Handle suggestion selection
  const handleSelectLocation = (suggestion: LocationSuggestion) => {
    setShowSuggestions(false);
    setSearchQuery(suggestion.display_name);
    onLocationSelect(suggestion.display_name);
    Keyboard.dismiss();
  };

  // Measure the input container to position suggestions properly
  const measureInputContainer = () => {
    if (Platform.OS === 'web' && inputRef.current && typeof document !== 'undefined') {
      setTimeout(() => {
        const element = inputRef.current as any;
        if (element && element.getBoundingClientRect) {
          const rect = element.getBoundingClientRect();
          setInputHeight(rect.height);
        }
      }, 100);
    }
  };

  // Measure on mount and when showing suggestions
  useEffect(() => {
    if (showSuggestions) {
      measureInputContainer();
    }
  }, [showSuggestions]);

  return (
    <View style={styles.container}>
      <View 
        ref={inputRef}
        style={styles.inputContainer}
        onLayout={measureInputContainer}
      >
        <Ionicons name="location-outline" size={20} color="#666" />
        <TextInput
          style={[styles.input, inputStyle]}
          value={searchQuery}
          onChangeText={handleSearchChange}
          placeholder={placeholder}
          placeholderTextColor="#666"
          onFocus={() => setShowSuggestions(true)}
        />
        {loading && <ActivityIndicator size="small" color="#4E6E5D" />}
        {searchQuery.length > 0 && (
          <TouchableOpacity 
            onPress={() => {
              setSearchQuery('');
              onLocationSelect('');
              setSuggestions([]);
            }}
            style={styles.clearButton}
          >
            <Ionicons name="close-circle" size={16} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {showSuggestions && searchQuery.length > 0 && (
        <View 
          style={[
            styles.suggestionsContainer,
            // Add web-specific styles for better layering
            Platform.OS === 'web' ? {
              position: 'absolute',
              top: inputHeight > 0 ? inputHeight + 8 : 48, // Position below input with padding
              width: '100%',
              zIndex: 9999,
            } : {}
          ]}
        >
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <FlatList
              style={{ maxHeight: 200 }}
              data={suggestions}
              keyExtractor={(item) => item.place_id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.suggestionItem}
                  onPress={() => handleSelectLocation(item)}
                >
                  <Ionicons name="location" size={16} color="#4E6E5D" />
                  <Text style={styles.suggestionText} numberOfLines={2}>
                    {item.display_name}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                !loading && searchQuery.length >= 3 ? (
                  <Text style={styles.noResultsText}>No locations found</Text>
                ) : searchQuery.length > 0 && searchQuery.length < 3 ? (
                  <Text style={styles.noResultsText}>Type at least 3 characters</Text>
                ) : null
              }
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 999,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    zIndex: 999,
  },
  input: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    padding: 8,
  },
  clearButton: {
    padding: 8,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 10, // Increase this value to move suggestions down
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    ...(Platform.OS === 'web' ? { pointerEvents: 'auto' } : {}),
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionText: {
    marginLeft: 8,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#333',
    flex: 1,
  },
  errorText: {
    padding: 12,
    color: '#e74c3c',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  noResultsText: {
    padding: 12,
    color: '#666',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
}); 