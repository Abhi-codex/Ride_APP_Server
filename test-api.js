import dotenv from 'dotenv';
dotenv.config();

console.log('Testing environment variables:');
console.log('API Key exists:', !!process.env.GOOGLE_PLACES_API_KEY);
console.log('API Key length:', process.env.GOOGLE_PLACES_API_KEY?.length || 0);
console.log('First 10 chars:', process.env.GOOGLE_PLACES_API_KEY?.substring(0, 10) || 'N/A');

// Test a simple API call
const testApiCall = async () => {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.log('❌ No API key found');
    return;
  }

  const testUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=28.6139,77.2090&radius=5000&type=hospital&key=${apiKey}`;
  
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(testUrl);
    const data = await response.json();
    
    console.log('\n📍 API Response Status:', data.status);
    console.log('📊 Results count:', data.results?.length || 0);
    
    if (data.error_message) {
      console.log('❌ API Error:', data.error_message);
    }
    
    if (data.results && data.results.length > 0) {
      console.log('✅ API is working! First hospital:', data.results[0].name);
    }
    
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
};

testApiCall();
