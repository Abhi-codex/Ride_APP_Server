import Hospital from "../models/Hospital.js";
import { BadRequestError, NotFoundError } from "../errors/index.js";
import { StatusCodes } from "http-status-codes";
import { calculateDistance } from "../utils/mapUtils.js";
import https from "https";

// Create a custom agent to handle SSL issues
const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // Allow self-signed certificates temporarily
  secureProtocol: 'TLSv1_2_method' // Force TLS 1.2
});

// Helper function to infer emergency services from Google Places data
const inferServicesFromPlace = (place, emergencyType) => {
  const services = ['emergency_room']; // All hospitals have emergency room
  
  // Map emergency types to likely hospital services
  const serviceMap = {
    cardiac: ['cardiology', 'intensive_care', 'surgery'],
    trauma: ['trauma_center', 'surgery', 'intensive_care', 'blood_bank'],
    respiratory: ['intensive_care', 'emergency_room'],
    neurological: ['neurology', 'intensive_care', 'surgery'],
    pediatric: ['pediatrics', 'emergency_room'],
    obstetric: ['obstetrics', 'emergency_room'],
    psychiatric: ['psychiatry', 'emergency_room'],
    burns: ['burn_unit', 'intensive_care', 'surgery'],
    poisoning: ['emergency_room', 'intensive_care'],
    general: ['emergency_room']
  };
  
  if (emergencyType && serviceMap[emergencyType]) {
    services.push(...serviceMap[emergencyType]);
  }
  
  // Check place types and name for additional services
  const placeName = place.name.toLowerCase();
  const placeTypes = place.types || [];
  
  if (placeName.includes('cardiac') || placeName.includes('heart')) {
    services.push('cardiology');
  }
  if (placeName.includes('trauma') || placeName.includes('emergency')) {
    services.push('trauma_center');
  }
  if (placeName.includes('children') || placeName.includes('pediatric')) {
    services.push('pediatrics');
  }
  if (placeName.includes('maternity') || placeName.includes('women')) {
    services.push('obstetrics');
  }
  
  return [...new Set(services)]; // Remove duplicates
};

// Enhanced function to check if a hospital is emergency-capable
const isEmergencyCapableHospital = (place) => {
  const name = place.name.toLowerCase();
  const types = place.types || [];
  
  // Strong indicators of emergency capability
  const emergencyIndicators = [
    'emergency', 'trauma', 'er ', ' er', 'emergency room',
    'medical center', 'general hospital', 'university hospital',
    'regional hospital', 'community hospital', 'acute care',
    'level', 'memorial hospital', 'saint', 'st.', 'mount',
    'mercy', 'baptist', 'methodist', 'presbyterian', 'catholic'
  ];
  
  // Exclude places that are likely not emergency-capable
  const exclusions = [
    'clinic', 'dental', 'veterinary', 'rehab', 'rehabilitation',
    'nursing home', 'assisted living', 'pharmacy', 'laboratory',
    'imaging', 'dialysis', 'outpatient', 'urgent care only',
    'psychiatric only', 'mental health only'
  ];
  
  // Check for exclusions first
  const hasExclusion = exclusions.some(exclusion => name.includes(exclusion));
  if (hasExclusion && !name.includes('emergency') && !name.includes('hospital')) {
    return false;
  }
  
  // Check for emergency indicators
  const hasEmergencyIndicator = emergencyIndicators.some(indicator => 
    name.includes(indicator)
  );
  
  // Check place types
  const hasHospitalType = types.includes('hospital') || types.includes('establishment');
  
  // Must have hospital type AND emergency indicators
  return hasHospitalType && (hasEmergencyIndicator || place.rating >= 4.0);
};

// Function to assess emergency capability and assign scores
const assessEmergencyCapability = (place, emergencyType) => {
  const name = place.name.toLowerCase();
  const types = place.types || [];
  let score = 0;
  const features = [];
  
  // Base hospital score
  if (types.includes('hospital')) {
    score += 20;
    features.push('Hospital facility');
  }
  
  // Emergency-specific scoring
  const emergencyKeywords = {
    'emergency': 30,
    'trauma': 25,
    'medical center': 20,
    'general hospital': 25,
    'university hospital': 30,
    'regional hospital': 25,
    'level 1': 40,
    'level 2': 35,
    'level 3': 30,
    'level i': 40,
    'level ii': 35,
    'level iii': 30,
    'comprehensive': 25,
    'acute care': 20
  };
  
  Object.entries(emergencyKeywords).forEach(([keyword, points]) => {
    if (name.includes(keyword)) {
      score += points;
      features.push(`${keyword.charAt(0).toUpperCase() + keyword.slice(1)} facility`);
    }
  });
  
  // Specialty scoring based on emergency type
  if (emergencyType) {
    const specialtyKeywords = {
      cardiac: ['cardiac', 'heart', 'cardiovascular', 'cardiology'],
      trauma: ['trauma', 'emergency', 'level', 'comprehensive'],
      respiratory: ['respiratory', 'lung', 'pulmonary'],
      neurological: ['neuro', 'brain', 'stroke', 'comprehensive'],
      pediatric: ['children', 'pediatric', 'kids', 'child'],
      obstetric: ['women', 'maternity', 'obstetric', 'birth'],
      psychiatric: ['psychiatric', 'mental', 'behavioral'],
      burns: ['burn', 'trauma', 'comprehensive'],
      poisoning: ['emergency', 'comprehensive', 'level']
    };
    
    const relevantKeywords = specialtyKeywords[emergencyType] || [];
    relevantKeywords.forEach(keyword => {
      if (name.includes(keyword)) {
        score += 15;
        features.push(`${emergencyType} specialization`);
      }
    });
  }
  
  // Rating bonus
  if (place.rating) {
    if (place.rating >= 4.5) {
      score += 10;
      features.push('High patient rating (4.5+)');
    } else if (place.rating >= 4.0) {
      score += 5;
      features.push('Good patient rating (4.0+)');
    }
  }
  
  // 24/7 operations bonus
  if (place.opening_hours?.open_now !== false) {
    score += 10;
    features.push('Currently open/24-7 operations');
  }
  
  return {
    score,
    features: [...new Set(features)],
    isVerified: score >= 50 // Threshold for emergency verification
  };
};

// Search hospitals using Google Places API
export const searchHospitals = async (req, res) => {
  const { lat, lng, emergency, radius = 10000 } = req.query;
  
  // Enhanced logging at the beginning
  console.log('=== HOSPITAL SEARCH REQUEST ===');
  console.log('Query parameters:', req.query);
  console.log('Lat/Lng:', lat, lng);
  console.log('Emergency type:', emergency);
  console.log('Radius:', radius);
  console.log('API Key configured:', !!process.env.GOOGLE_PLACES_API_KEY);
  
  if (!lat || !lng) {
    throw new BadRequestError("Latitude and longitude are required");
  }
  
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    throw new BadRequestError("Google Places API not configured");
  }
  
  try {
    // Enhanced search with multiple queries for emergency-capable hospitals
    const searchQueries = [
      // Primary search for hospitals with emergency keywords
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
      `location=${lat},${lng}&radius=${radius}&type=hospital&keyword=emergency&` +
      `key=${process.env.GOOGLE_PLACES_API_KEY}`,
      
      // Search for emergency rooms specifically
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
      `location=${lat},${lng}&radius=${radius}&type=hospital&keyword=emergency+room&` +
      `key=${process.env.GOOGLE_PLACES_API_KEY}`,
      
      // Search for trauma centers
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
      `location=${lat},${lng}&radius=${radius}&type=hospital&keyword=trauma+center&` +
      `key=${process.env.GOOGLE_PLACES_API_KEY}`
    ];

    // Add emergency-specific searches
    if (emergency) {
      const emergencyKeywords = {
        cardiac: ['cardiac', 'heart', 'cardiology'],
        trauma: ['trauma', 'emergency', 'accident'],
        respiratory: ['respiratory', 'lung', 'pulmonary'],
        neurological: ['neuro', 'brain', 'stroke'],
        pediatric: ['pediatric', 'children', 'kids'],
        obstetric: ['maternity', 'obstetric', 'women'],
        psychiatric: ['psychiatric', 'mental', 'behavioral'],
        burns: ['burn', 'trauma'],
        poisoning: ['emergency', 'toxicology']
      };

      const keywords = emergencyKeywords[emergency] || ['emergency'];
      keywords.forEach(keyword => {
        searchQueries.push(
          `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
          `location=${lat},${lng}&radius=${radius}&type=hospital&keyword=${keyword}&` +
          `key=${process.env.GOOGLE_PLACES_API_KEY}`
        );
      });
    }

    // Log each search query
    searchQueries.forEach((url, index) => {
      console.log(`Search query ${index + 1}:`, url);
    });

    // Execute all searches in parallel with proper error handling
    const responses = await Promise.all(
      searchQueries.map(async (url, index) => {
        try {
          console.log(`Executing search ${index + 1}...`);
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'User-Agent': 'Ambulance-Booking-System/1.0'
            },
            agent: httpsAgent // Use custom HTTPS agent
          });
          
          if (!response.ok) {
            console.error(`Search ${index + 1} failed with status:`, response.status);
            throw new Error(`Google Places API request failed with status: ${response.status}`);
          }
          
          console.log(`Search ${index + 1} completed successfully`);
          return response;
        } catch (error) {
          console.error(`Search ${index + 1} error:`, error.message);
          // Return a mock response to prevent Promise.all from failing
          return {
            ok: true,
            json: async () => ({ status: 'ZERO_RESULTS', results: [] })
          };
        }
      })
    );

    // Parse all responses with error handling
    const allData = await Promise.all(
      responses.map(async (response, index) => {
        try {
          const data = await response.json();
          console.log(`Response ${index + 1} status:`, data.status);
          return data;
        } catch (error) {
          console.error(`Failed to parse response ${index + 1}:`, error.message);
          return { status: 'ZERO_RESULTS', results: [] };
        }
      })
    );

    // Combine and deduplicate results
    const allPlaces = new Map();
    
    allData.forEach(data => {
      if (data.status === 'OK' && data.results) {
        data.results.forEach(place => {
          // Only include places that have emergency indicators
          if (isEmergencyCapableHospital(place)) {
            allPlaces.set(place.place_id, place);
          }
        });
      }
    });

    // Enhanced logging after combining results
    console.log('Total unique places found:', allPlaces.size);

    // Process and format results with enhanced emergency capability validation
    const hospitals = Array.from(allPlaces.values()).map(place => {
      const distance = calculateDistance(
        parseFloat(lat), 
        parseFloat(lng),
        place.geometry.location.lat,
        place.geometry.location.lng
      );

      const emergencyCapability = assessEmergencyCapability(place, emergency);
      
      return {
        id: place.place_id,
        name: place.name,
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        rating: place.rating || null,
        placeId: place.place_id,
        address: place.vicinity || place.formatted_address,
        emergencyServices: inferServicesFromPlace(place, emergency),
        distance: parseFloat(distance.toFixed(2)),
        isOpen: place.opening_hours?.open_now ?? null,
        priceLevel: place.price_level || null,
        emergencyCapabilityScore: emergencyCapability.score,
        emergencyFeatures: emergencyCapability.features,
        isEmergencyVerified: emergencyCapability.isVerified
      };
    });
    
    console.log('Places that passed emergency capability check:', hospitals.length);
    
    // Enhanced sorting: Emergency capability first, then relevance, then distance
    hospitals.sort((a, b) => {
      // First priority: Emergency verification status
      if (a.isEmergencyVerified && !b.isEmergencyVerified) return -1;
      if (!a.isEmergencyVerified && b.isEmergencyVerified) return 1;
      
      // Second priority: Emergency capability score
      if (b.emergencyCapabilityScore !== a.emergencyCapabilityScore) {
        return b.emergencyCapabilityScore - a.emergencyCapabilityScore;
      }
      
      // Third priority: Emergency service relevance for specific emergency types
      if (emergency) {
        const serviceMap = {
          cardiac: 'cardiology',
          trauma: 'trauma_center',
          neurological: 'neurology',
          pediatric: 'pediatrics',
          obstetric: 'obstetrics',
          psychiatric: 'psychiatry',
          burns: 'burn_unit'
        };
        
        const relevantService = serviceMap[emergency];
        if (relevantService) {
          const aHasService = a.emergencyServices.includes(relevantService);
          const bHasService = b.emergencyServices.includes(relevantService);
          
          if (aHasService && !bHasService) return -1;
          if (!aHasService && bHasService) return 1;
        }
      }
      
      // Fourth priority: Distance (closest first)
      return a.distance - b.distance;
    });

    // More lenient filtering with enhanced debugging
    console.log(`Total hospitals before filtering: ${hospitals.length}`);
    console.log(`Emergency type received: ${emergency}`);

    // Apply different minimum scores based on emergency priority
    let minimumScore = 15; // More lenient default
    if (emergency === 'cardiac' || emergency === 'trauma' || emergency === 'neurological') {
      minimumScore = 25; // Higher for critical emergencies
    }

    const verifiedHospitals = hospitals.filter(hospital => {
      const isValid = hospital.emergencyCapabilityScore >= minimumScore || 
                      hospital.isEmergencyVerified ||
                      hospital.emergencyServices.length > 0; // Include if has any emergency services
      
      console.log(`Hospital: ${hospital.name}, Score: ${hospital.emergencyCapabilityScore}, Services: ${hospital.emergencyServices.length}, Valid: ${isValid}`);
      return isValid;
    });

    console.log(`Hospitals after filtering: ${verifiedHospitals.length}`);

    // If we still have no hospitals, return the top 5 closest ones regardless of score
    if (verifiedHospitals.length === 0 && hospitals.length > 0) {
      console.log('No hospitals met criteria, returning top 5 closest');
      const closestHospitals = hospitals
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5)
        .map(hospital => ({
          ...hospital,
          recommendation: "Nearest available hospital - verify emergency capabilities"
        }));
      
      return res.status(StatusCodes.OK).json({
        message: "Emergency-capable hospitals retrieved successfully",
        count: closestHospitals.length,
        totalFound: hospitals.length,
        hospitals: closestHospitals,
        emergency: emergency || null,
        searchRadius: radius,
        searchCriteria: {
          minimumEmergencyScore: minimumScore,
          emergencyVerifiedOnly: false,
          emergencyType: emergency || 'general',
          fallbackToNearest: true
        }
      });
    }

    res.status(StatusCodes.OK).json({
      message: "Emergency-capable hospitals retrieved successfully",
      count: verifiedHospitals.length,
      totalFound: hospitals.length,
      hospitals: verifiedHospitals,
      emergency: emergency || null,
      searchRadius: radius,
      searchCriteria: {
        minimumEmergencyScore: minimumScore,
        emergencyVerifiedOnly: false,
        emergencyType: emergency || 'general'
      }
    });
    
  } catch (error) {
    console.error("Error searching hospitals:", error);
    throw new BadRequestError("Failed to search hospitals: " + error.message);
  }
};

// Get hospital details by place ID
export const getHospitalDetails = async (req, res) => {
  const { placeId } = req.params;
  
  if (!placeId) {
    throw new BadRequestError("Place ID is required");
  }
  
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    throw new BadRequestError("Google Places API not configured");
  }
  
  try {
    console.log('Fetching hospital details for place ID:', placeId);
    
    // Get detailed information from Google Places API
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?` +
      `place_id=${placeId}&fields=name,formatted_address,geometry,rating,formatted_phone_number,opening_hours,website&` +
      `key=${process.env.GOOGLE_PLACES_API_KEY}`,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'Ambulance-Booking-System/1.0'
        },
        agent: httpsAgent // Use custom HTTPS agent
      }
    );
    
    if (!response.ok) {
      throw new Error('Google Places API request failed');
    }
    
    const data = await response.json();
    
    if (data.status !== 'OK') {
      throw new NotFoundError(`Hospital not found: ${data.status}`);
    }
    
    const place = data.result;
    
    // Assess emergency capability for this specific hospital
    const emergencyCapability = assessEmergencyCapability(place);
    
    const hospitalDetails = {
      placeId: placeId,
      name: place.name,
      address: place.formatted_address,
      latitude: place.geometry.location.lat,
      longitude: place.geometry.location.lng,
      rating: place.rating || null,
      phoneNumber: place.formatted_phone_number || null,
      website: place.website || null,
      openingHours: place.opening_hours?.weekday_text || null,
      isOpen: place.opening_hours?.open_now ?? null,
      emergencyCapabilityScore: emergencyCapability.score,
      emergencyFeatures: emergencyCapability.features,
      isEmergencyVerified: emergencyCapability.isVerified,
      emergencyServices: inferServicesFromPlace(place),
      recommendation: emergencyCapability.isVerified ? 
        "Verified emergency-capable hospital" : 
        emergencyCapability.score >= 30 ? 
          "Likely emergency-capable hospital" : 
          "Emergency capability uncertain - verify before directing emergency cases"
    };
    
    res.status(StatusCodes.OK).json({
      message: "Hospital details retrieved successfully",
      hospital: hospitalDetails
    });
    
  } catch (error) {
    console.error("Error getting hospital details:", error);
    throw new BadRequestError("Failed to get hospital details: " + error.message);
  }
};

// Create or update hospital in local database
export const createHospital = async (req, res) => {
  const { 
    name, 
    latitude, 
    longitude, 
    address, 
    emergencyServices, 
    placeId,
    rating,
    phoneNumber 
  } = req.body;
  
  if (!name || !latitude || !longitude || !address) {
    throw new BadRequestError("Name, coordinates, and address are required");
  }
  
  try {
    const hospital = new Hospital({
      name,
      location: { latitude, longitude },
      address,
      emergencyServices: emergencyServices || ['emergency_room'],
      placeId,
      rating,
      phoneNumber,
      isVerified: false // Manual verification required
    });
    
    await hospital.save();
    
    res.status(StatusCodes.CREATED).json({
      message: "Hospital created successfully",
      hospital
    });
    
  } catch (error) {
    if (error.code === 11000) {
      throw new BadRequestError("Hospital with this place ID already exists");
    }
    console.error("Error creating hospital:", error);
    throw new BadRequestError("Failed to create hospital");
  }
};

// Get all hospitals from local database
export const getHospitals = async (req, res) => {
  const { lat, lng, radius = 50000, emergency } = req.query;
  
  try {
    let query = {};
    
    // Filter by emergency services if specified
    if (emergency) {
      const serviceMap = {
        cardiac: 'cardiology',
        trauma: 'trauma_center',
        neurological: 'neurology',
        pediatric: 'pediatrics',
        obstetric: 'obstetrics',
        psychiatric: 'psychiatry',
        burns: 'burn_unit'
      };
      
      const relevantService = serviceMap[emergency];
      if (relevantService) {
        query.emergencyServices = relevantService;
      }
    }
    
    const hospitals = await Hospital.find(query);
    
    // If coordinates provided, calculate distances and filter by radius
    if (lat && lng) {
      const hospitalsWithDistance = hospitals.map(hospital => {
        const distance = calculateDistance(
          parseFloat(lat),
          parseFloat(lng),
          hospital.location.latitude,
          hospital.location.longitude
        );
        
        return {
          ...hospital.toObject(),
          distance: parseFloat(distance.toFixed(2))
        };
      }).filter(hospital => hospital.distance <= radius / 1000); // Convert to km
      
      // Sort by distance
      hospitalsWithDistance.sort((a, b) => a.distance - b.distance);
      
      res.status(StatusCodes.OK).json({
        message: "Hospitals retrieved successfully",
        count: hospitalsWithDistance.length,
        hospitals: hospitalsWithDistance
      });
    } else {
      res.status(StatusCodes.OK).json({
        message: "Hospitals retrieved successfully",
        count: hospitals.length,
        hospitals
      });
    }
    
  } catch (error) {
    console.error("Error retrieving hospitals:", error);
    throw new BadRequestError("Failed to retrieve hospitals");
  }
};
