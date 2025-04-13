/**
 * Backend Connectivity Check Script
 * 
 * This script will check if the backend server is running and if CORS is properly configured.
 * Run this script with Node.js before trying to use the app.
 */

const checkBackend = async () => {
  console.log('Checking backend connectivity...');
  
  // Configuration
  const BACKEND_URL = 'http://localhost:5000'; // Change this if your backend uses a different port
  const TEST_ENDPOINTS = [
    '/api/ping',
    '/api/test',
  ];
  
  // Check if the server is running
  try {
    for (const endpoint of TEST_ENDPOINTS) {
      const url = `${BACKEND_URL}${endpoint}`;
      console.log(`Checking endpoint: ${url}`);
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Endpoint ${endpoint} is working:`, data);
        } else {
          console.error(`❌ Endpoint ${endpoint} returned status: ${response.status}`);
          if (response.status === 404) {
            console.log(`   This endpoint might not exist. Check your API routes.`);
          } else {
            try {
              const errorData = await response.json();
              console.error(`   Error details:`, errorData);
            } catch (e) {
              console.error(`   Could not parse error response.`);
            }
          }
        }
      } catch (error) {
        console.error(`❌ Failed to connect to ${endpoint}:`, error.message);
        if (error.message.includes('fetch')) {
          console.log(`   This likely means the backend server is not running.`);
          console.log(`   Start your backend server with: cd backend && python main.py`);
        }
      }
    }
    
    // Check CORS configuration
    console.log('\nChecking CORS configuration...');
    const corsCheckUrl = `${BACKEND_URL}/api/ping`;
    
    try {
      const corsResponse = await fetch(corsCheckUrl, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:8081',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Content-Type, Authorization',
        },
      });
      
      if (corsResponse.ok) {
        console.log('✅ CORS preflight request succeeded');
        
        // Check the required headers
        const headers = corsResponse.headers;
        const requiredHeaders = [
          'Access-Control-Allow-Origin',
          'Access-Control-Allow-Methods',
          'Access-Control-Allow-Headers',
        ];
        
        let allHeadersPresent = true;
        for (const header of requiredHeaders) {
          if (headers.get(header)) {
            console.log(`   ✅ ${header}: ${headers.get(header)}`);
          } else {
            console.log(`   ❌ Missing header: ${header}`);
            allHeadersPresent = false;
          }
        }
        
        if (allHeadersPresent) {
          console.log('✅ CORS is properly configured!');
        } else {
          console.log('❌ Some CORS headers are missing. Check your backend CORS configuration.');
        }
      } else {
        console.error('❌ CORS preflight request failed with status:', corsResponse.status);
      }
    } catch (error) {
      console.error('❌ Error checking CORS configuration:', error.message);
    }
    
    console.log('\nBackend connectivity check completed.');
  } catch (error) {
    console.error('❌ Global error during backend check:', error.message);
  }
};

// Run the check function
checkBackend().catch(err => {
  console.error('Failed to run backend check:', err);
}); 