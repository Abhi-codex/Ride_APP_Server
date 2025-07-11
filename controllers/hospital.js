import Hospital from "../models/Hospital.js";
import { BadRequestError, NotFoundError } from "../errors/index.js";
import { StatusCodes } from "http-status-codes";
import { calculateDistance } from "../utils/mapUtils.js";

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

// Search hospitals using Google Places API
export const searchHospitals = async (req, res) => {
  const { lat, lng, emergency, radius = 10000 } = req.query;
  
  if (!lat || !lng) {
    throw new BadRequestError("Latitude and longitude are required");
  }
  
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    throw new BadRequestError("Google Places API not configured");
  }
  
  try {
    // Search using Google Places API
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
      `location=${lat},${lng}&radius=${radius}&type=hospital&` +
      `key=${process.env.GOOGLE_PLACES_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error('Google Places API request failed');
    }
    
    const data = await response.json();
    
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Places API error: ${data.status}`);
    }
    
    // Process and format results
    const hospitals = data.results.map(place => {
      const distance = calculateDistance(
        parseFloat(lat), 
        parseFloat(lng),
        place.geometry.location.lat,
        place.geometry.location.lng
      );
      
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
        priceLevel: place.price_level || null
      };
    });
    
    // Sort by distance and emergency service relevance
    hospitals.sort((a, b) => {
      // Prioritize hospitals with relevant emergency services
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
      
      // Then sort by distance
      return a.distance - b.distance;
    });
    
    res.status(StatusCodes.OK).json({
      message: "Hospitals retrieved successfully",
      count: hospitals.length,
      hospitals,
      emergency: emergency || null,
      searchRadius: radius
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
    // Get detailed information from Google Places API
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?` +
      `place_id=${placeId}&fields=name,formatted_address,geometry,rating,formatted_phone_number,opening_hours,website&` +
      `key=${process.env.GOOGLE_PLACES_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error('Google Places API request failed');
    }
    
    const data = await response.json();
    
    if (data.status !== 'OK') {
      throw new NotFoundError(`Hospital not found: ${data.status}`);
    }
    
    const place = data.result;
    
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
      isOpen: place.opening_hours?.open_now ?? null
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
