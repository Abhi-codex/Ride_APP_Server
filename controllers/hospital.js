import Hospital from "../models/Hospital.js";
import { BadRequestError } from "../errors/index.js";
import { StatusCodes } from "http-status-codes";
import { calculateDistance } from "../utils/ambulance.js";
import https from "https";
import process from "process";

const httpsAgent = new https.Agent({
  rejectUnauthorized: false, 
  secureProtocol: 'TLSv1_2_method'
});

// Consolidated constants to avoid redundancy
const EMERGENCY_SERVICE_MAP = {
  cardiac: 'cardiology',
  trauma: 'trauma_center',
  neurological: 'neurology',
  pediatric: 'pediatrics',
  obstetric: 'obstetrics',
  psychiatric: 'psychiatry',
  burns: 'burn_unit'
};

// Get details for a specific hospital by placeId
export const getHospitalDetails = async (req, res) => {
  const { placeId } = req.params;
  if (!placeId) {
    return res.status(400).json({ error: "Missing placeId parameter" });
  }
  try {
    // Fetch from Google Places API
    if (!process.env.GOOGLE_PLACES_API_KEY) {
      throw new BadRequestError("Google Places API not configured");
    }
    const detailsUrl = `https://places.googleapis.com/v1/places/${placeId}`;
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(detailsUrl, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'id,displayName,location,formattedAddress,internationalPhoneNumber,websiteUri,rating,currentOpeningHours,photos,types'
      },
      agent: httpsAgent
    });
    const data = await response.json();
    if (!data.id) {
      return res.status(404).json({ error: "Hospital not found in Google Places" });
    }
    // Fetch from local DB
    const dbHospital = await Hospital.findOne({ placeId });
    const result = data; // New Places API returns data directly, not in a 'result' wrapper
    
    // Format photos
    let photos = [];
    if (result.photos && Array.isArray(result.photos)) {
      photos = result.photos.slice(0, 5).map(photo => ({
        photoReference: photo.name,
        width: photo.widthPx,
        height: photo.heightPx,
        attributions: photo.authorAttributions?.map(attr => attr.displayName) || []
      }));
    }
    // Emergency capability score (simple example)
    let emergencyCapabilityScore = 0;
    let emergencyFeatures = [];
    let isEmergencyVerified = false;
    let emergencyServices = [];
    // Use types and DB info to infer emergency capability
    if (result.types && result.types.includes('hospital')) {
      emergencyCapabilityScore += 20;
      emergencyFeatures.push('Hospital facility');
    }
    if (result.displayName && /emergency|trauma|critical|ICU|intensive/i.test(result.displayName.text)) {
      emergencyCapabilityScore += 25;
      emergencyFeatures.push('Emergency facility');
      isEmergencyVerified = true;
    }
    if (result.rating && result.rating >= 4.0) {
      emergencyCapabilityScore += 10;
      emergencyFeatures.push('High patient rating (4.0+)');
    }
    if (result.currentOpeningHours && result.currentOpeningHours.openNow) {
      emergencyCapabilityScore += 10;
      emergencyFeatures.push('Currently open/24-7 operations');
    }
    if (dbHospital && dbHospital.emergencyServices) {
      emergencyServices = dbHospital.emergencyServices;
      emergencyCapabilityScore += 15;
      emergencyFeatures.push('Emergency services from DB');
      if (dbHospital.isVerified) isEmergencyVerified = true;
    }
    // Recommendation
    let recommendation = isEmergencyVerified ? "Verified emergency-capable hospital" : "General hospital";
    // Format response
    const hospitalDetails = {
      placeId,
      name: result.displayName?.text || dbHospital?.name,
      address: result.formattedAddress || dbHospital?.address,
      latitude: result.location?.latitude || dbHospital?.location?.latitude,
      longitude: result.location?.longitude || dbHospital?.location?.longitude,
      rating: result.rating || dbHospital?.rating,
      phoneNumber: result.internationalPhoneNumber || dbHospital?.phoneNumber,
      website: result.websiteUri || null,
      openingHours: result.currentOpeningHours?.weekdayDescriptions || [],
      isOpen: result.currentOpeningHours?.openNow || false,
      photos,
      emergencyCapabilityScore,
      emergencyFeatures,
      isEmergencyVerified,
      emergencyServices,
      recommendation
    };
    res.status(200).json({ message: "Hospital details retrieved successfully", hospital: hospitalDetails });
  } catch (error) {
    console.error("Error fetching hospital details:", error);
    res.status(500).json({ error: "Failed to fetch hospital details" });
  }
};
const SERVICE_MAP = {
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

const EMERGENCY_SEARCH_KEYWORDS = {
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

const SPECIALTY_KEYWORDS = {
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

const EMERGENCY_SCORING_KEYWORDS = {
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

const inferServicesFromPlace = (place, emergencyType) => {
  const services = ['emergency_room']; // All hospitals have emergency room
  
  if (emergencyType && SERVICE_MAP[emergencyType]) {
    services.push(...SERVICE_MAP[emergencyType]);
  }
  
  const placeName = place.name.toLowerCase();
  
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

// Function to check if a hospital is emergency-capable
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
  const exclusions = [
    'clinic', 'dental', 'veterinary', 'rehab', 'rehabilitation',
    'nursing home', 'assisted living', 'pharmacy', 'laboratory',
    'imaging', 'dialysis', 'outpatient', 'urgent care only',
    'psychiatric only', 'mental health only'
  ];
  
  const hasExclusion = exclusions.some(exclusion => name.includes(exclusion));
  if (hasExclusion && !name.includes('emergency') && !name.includes('hospital')) {
    return false;
  }
  const hasEmergencyIndicator = emergencyIndicators.some(indicator => 
    name.includes(indicator)
  );
  const hasHospitalType = types.includes('hospital') || types.includes('establishment');
  return hasHospitalType && (hasEmergencyIndicator || place.rating >= 4.0);
};

// Function to assess emergency capability and assign scores
const assessEmergencyCapability = (place, emergencyType) => {
  const name = place.name.toLowerCase();
  const types = place.types || [];
  let score = 0;
  const features = [];
  
  if (types.includes('hospital')) {
    score += 20;
    features.push('Hospital facility');
  }
  
  Object.entries(EMERGENCY_SCORING_KEYWORDS).forEach(([keyword, points]) => {
    if (name.includes(keyword)) {
      score += points;
      features.push(`${keyword.charAt(0).toUpperCase() + keyword.slice(1)} facility`);
    }
  });
  
  if (emergencyType) {
    const relevantKeywords = SPECIALTY_KEYWORDS[emergencyType] || [];
    relevantKeywords.forEach(keyword => {
      if (name.includes(keyword)) {
        score += 15;
        features.push(`${emergencyType} specialization`);
      }
    });
  }
  
  if (place.rating) {
    if (place.rating >= 4.5) {
      score += 10;
      features.push('High patient rating (4.5+)');
    } else if (place.rating >= 4.0) {
      score += 5;
      features.push('Good patient rating (4.0+)');
    }
  }
  
  if (place.opening_hours?.open_now !== false) {
    score += 10;
    features.push('Currently open/24-7 operations');
  }
  
  return {
    score,
    features: [...new Set(features)],
    isVerified: score >= 50 
  };
};

// Search hospitals using Google Places API
export const searchHospitals = async (req, res) => {
  const { lat, lng, emergency, radius = 5000 } = req.query;
  
  if (!lat || !lng) {
    throw new BadRequestError("Latitude and longitude are required");
  }
  
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    throw new BadRequestError("Google Places API not configured");
  }
  try {
    console.log('🔍 Starting hospital search with params:', { lat, lng, emergency, radius: `${radius}m (${parseFloat(radius)/1000}km)` });
    console.log('🗝️ New Places API Key present:', !!process.env.GOOGLE_PLACES_API_KEY);
    
    // New Places API - Text Search requests
    const searchQueries = [];
    
    // Base hospital search queries
    const baseQueries = [
      'hospital emergency near me',
      'emergency room hospital',
      'trauma center hospital'
    ];
    
    // Add emergency-specific queries
    if (emergency) {
      const keywords = EMERGENCY_SEARCH_KEYWORDS[emergency] || ['emergency'];
      keywords.forEach(keyword => {
        baseQueries.push(`${keyword} hospital near me`);
      });
    }
    
    // Create request bodies for new Places API
    baseQueries.forEach(query => {
      searchQueries.push({
        url: 'https://places.googleapis.com/v1/places:searchText',
        body: {
          textQuery: query,
          locationBias: {
            circle: {
              center: {
                latitude: parseFloat(lat),
                longitude: parseFloat(lng)
              },
              radius: parseFloat(radius)
            }
          },
          maxResultCount: 20
        }
      });
    });

    let hospitals = [];
    let apiError = false;
    try {
      console.log('📡 Making requests to New Places API with', searchQueries.length, 'queries...');
      const responses = await Promise.all(
        searchQueries.map(async (queryData) => {
          try {
            const fetch = (await import('node-fetch')).default;
            const response = await fetch(queryData.url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.rating,places.formattedAddress,places.types,places.businessStatus,places.currentOpeningHours,places.photos'
              },
              body: JSON.stringify(queryData.body),
              agent: httpsAgent
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error(`❌ New Places API Error (${response.status}):`, errorText);
              throw new Error(`New Places API request failed with status: ${response.status}`);
            }
            return response;
          } catch (error) {
            console.error('❌ API request failed:', error.message);
            return {
              ok: true,
              json: async () => ({ places: [] })
            };
          }
        })
      );

      const allData = await Promise.all(
        responses.map(async (response) => {
          try {
            const data = await response.json();
            console.log('📊 New Places API Response - Places found:', data.places?.length || 0);
            if (data.error) {
              console.log('❌ API Error:', data.error.message);
            }
            return data;
          } catch (error) {
            console.error('❌ Error parsing response:', error.message);
            return { places: [] };
          }
        })
      );

      const allPlaces = new Map();
      allData.forEach(data => {
        if (data.places && Array.isArray(data.places)) {
          data.places.forEach(place => {
            // Convert new Places API format to match our existing logic
            const convertedPlace = {
              place_id: place.id,
              name: place.displayName?.text || 'Unknown Hospital',
              geometry: {
                location: {
                  lat: place.location?.latitude,
                  lng: place.location?.longitude
                }
              },
              rating: place.rating,
              formatted_address: place.formattedAddress,
              vicinity: place.formattedAddress,
              types: place.types || ['hospital'],
              opening_hours: place.currentOpeningHours ? {
                open_now: place.currentOpeningHours.openNow
              } : undefined,
              photos: place.photos ? place.photos.map(photo => ({
                photo_reference: photo.name,
                width: photo.widthPx,
                height: photo.heightPx
              })) : undefined
            };
            
            if (isEmergencyCapableHospital(convertedPlace)) {
              allPlaces.set(place.id, convertedPlace);
            }
          });
        }
      });

      const radiusKm = parseFloat(radius) / 1000; // Convert meters to kilometers
      
      hospitals = await Promise.all(
        Array.from(allPlaces.values()).map(async (place) => {
          const distance = calculateDistance(
            parseFloat(lat), 
            parseFloat(lng),
            place.geometry.location.lat,
            place.geometry.location.lng
          );
          
          // Filter out hospitals that are outside the specified radius
          if (distance > radiusKm) {
            return null; // Will be filtered out later
          }
          
          const emergencyCapability = assessEmergencyCapability(place, emergency);

          let photos = place.photos ? place.photos.slice(0, 1).map(photo => ({
            photoReference: photo.photo_reference,
            width: photo.width,
            height: photo.height
          })) : [];

          if (photos.length === 0 && (emergencyCapability.isVerified || place.rating >= 4.0)) {
            try {
              // For new Places API, photos are already included in the main response
              // If we need more photos, we would use Place Details (New)
              const fetch = (await import('node-fetch')).default;
              const detailsResponse = await fetch(
                `https://places.googleapis.com/v1/places/${place.place_id}`,
                {
                  method: 'GET',
                  headers: {
                    'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
                    'X-Goog-FieldMask': 'photos'
                  },
                  agent: httpsAgent
                }
              );
              if (detailsResponse.ok) {
                const detailsData = await detailsResponse.json();
                if (detailsData.photos && detailsData.photos.length > 0) {
                  photos = detailsData.photos.slice(0, 1).map(photo => ({
                    photoReference: photo.name,
                    width: photo.widthPx,
                    height: photo.heightPx
                  }));
                }
              }
            } catch (error) {
              console.error('❌ Error fetching additional photos:', error.message);
              // Silent fail for photo fetch
            }
          }

          // Upsert hospital in MongoDB
          try {
            await Hospital.findOneAndUpdate(
              { placeId: place.place_id },
              {
                name: place.name,
                location: {
                  latitude: place.geometry.location.lat,
                  longitude: place.geometry.location.lng
                },
                address: place.vicinity || place.formatted_address,
                emergencyServices: inferServicesFromPlace(place, emergency),
                placeId: place.place_id,
                rating: place.rating || null,
                phoneNumber: place.formatted_phone_number || null,
                isVerified: emergencyCapability.isVerified,
                lastUpdated: new Date()
              },
              { upsert: true, new: true, setDefaultsOnInsert: true }
            );
          } catch (err) {
            console.error(`Error upserting hospital ${place.place_id}:`, err.message);
          }

          return {
            placeId: place.place_id,
            name: place.name,
            latitude: place.geometry.location.lat,
            longitude: place.geometry.location.lng,
            rating: place.rating || null,
            address: place.vicinity || place.formatted_address,
            emergencyServices: inferServicesFromPlace(place, emergency),
            distance: parseFloat(distance.toFixed(2)),
            isOpen: place.opening_hours?.open_now ?? null,
            priceLevel: place.price_level || null,
            photos: photos,
            emergencyCapabilityScore: emergencyCapability.score,
            emergencyFeatures: emergencyCapability.features,
            isEmergencyVerified: emergencyCapability.isVerified
          };
        })
      );
      
      // Filter out null values (hospitals outside radius) and log the filtering
      const initialCount = hospitals.length;
      hospitals = hospitals.filter(hospital => hospital !== null);
      console.log(`📍 Distance filtering: ${initialCount} found → ${hospitals.length} within ${radiusKm}km radius`);
      
      console.log('✅ New Places API successfully returned', hospitals.length, 'emergency-capable hospitals');
    } catch (apiErr) {
      apiError = true;
      console.error("❌ Google Maps API failed, falling back to DB:", apiErr.message);
      console.error("❌ Full API error:", apiErr);
    }

    // If API failed or no hospitals found, fallback to DB
    if (apiError || hospitals.length === 0) {
      console.log('🏥 Falling back to database. API Error:', apiError, 'Hospitals found from API:', hospitals.length);
      const dbHospitals = await Hospital.find({});
      console.log('📊 Found', dbHospitals.length, 'hospitals in database');
      
      const radiusKm = parseFloat(radius) / 1000;
      hospitals = dbHospitals.map(hospital => {
        const distance = lat && lng ? parseFloat(calculateDistance(
          parseFloat(lat),
          parseFloat(lng),
          hospital.location.latitude,
          hospital.location.longitude
        ).toFixed(2)) : null;
        
        return {
          placeId: hospital.placeId,
          name: hospital.name,
          latitude: hospital.location.latitude,
          longitude: hospital.location.longitude,
          rating: hospital.rating,
          address: hospital.address,
          emergencyServices: hospital.emergencyServices,
          distance: distance,
          isOpen: null,
          priceLevel: null,
          photos: [],
          emergencyCapabilityScore: null,
          emergencyFeatures: [],
          isEmergencyVerified: hospital.isVerified
        };
      }).filter(hospital => {
        // Filter by radius (convert radius from meters to km)
        const isWithinRadius = hospital.distance === null || hospital.distance <= radiusKm;
        return isWithinRadius;
      });
      
      console.log('📍 After distance filtering (', radiusKm, 'km):', hospitals.length, 'hospitals');
    }

    // sorting and filtering logic
    hospitals.sort((a, b) => {
      // 1. Emergency verified first
      if (a.isEmergencyVerified && !b.isEmergencyVerified) return -1;
      if (!a.isEmergencyVerified && b.isEmergencyVerified) return 1;

      // 2. Distance (closest first)
      if (a.distance !== b.distance) return a.distance - b.distance;

      // 3. Emergency capability score (higher first)
      if ((b.emergencyCapabilityScore ?? 0) !== (a.emergencyCapabilityScore ?? 0)) {
        return (b.emergencyCapabilityScore ?? 0) - (a.emergencyCapabilityScore ?? 0);
      }

      // 4. Emergency service relevance for specific emergency types
      if (emergency) {
        const relevantService = EMERGENCY_SERVICE_MAP[emergency];
        if (relevantService) {
          const aHasService = a.emergencyServices.includes(relevantService);
          const bHasService = b.emergencyServices.includes(relevantService);
          if (aHasService && !bHasService) return -1;
          if (!aHasService && bHasService) return 1;
        }
      }

      // 5. Alphabetical by name as final fallback
      return a.name.localeCompare(b.name);
    });

    let minimumScore = 15;
    if (emergency === 'cardiac' || emergency === 'trauma' || emergency === 'neurological') {
      minimumScore = 25;
    }

    const verifiedHospitals = hospitals.filter(hospital => {
      return (hospital.emergencyCapabilityScore === null || hospital.emergencyCapabilityScore >= minimumScore) || 
             hospital.isEmergencyVerified ||
             (hospital.emergencyServices && hospital.emergencyServices.length > 0);
    });

    if (verifiedHospitals.length === 0 && hospitals.length > 0) {
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
  // ...existing code for searchHospitals ends here...
}

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
      const relevantService = EMERGENCY_SERVICE_MAP[emergency];
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

// Get hospital photo by photo reference
export const getHospitalPhoto = async (req, res) => {
  const { photoReference } = req.params;
  const { maxwidth = 400, maxheight = 400 } = req.query;
  
  if (!photoReference) {
    throw new BadRequestError("Photo reference is required");
  }
  
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    throw new BadRequestError("Google Places API not configured");
  }
  
  try {
    // New Places API uses photo names instead of photo references
    const photoUrl = `https://places.googleapis.com/v1/${photoReference}/media?maxWidthPx=${maxwidth}&maxHeightPx=${maxheight}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
    
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(photoUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Ambulance-Booking-System/1.0'
      },
      agent: httpsAgent
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch photo: ${response.status}`);
    }
    
    // Get the content type from the response
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // Set appropriate headers for image response
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      'Access-Control-Allow-Origin': '*'
    });
    
    // Get the image buffer and send it
    const imageBuffer = await response.arrayBuffer();
    res.send(Buffer.from(imageBuffer));
    
  } catch (error) {
    console.error("Error fetching hospital photo:", error);
    throw new BadRequestError("Failed to fetch hospital photo: " + error.message);
  }
};
