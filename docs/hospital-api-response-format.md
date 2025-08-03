# Hospital Search API - Response Format Documentation

## Overview
This document provides the complete response format for the Hospital Search API endpoint used in the ambulance booking system. This format should be used when integrating with the frontend application.

## API Endpoint

**GET** `/api/hospitals/search`

**Query Parameters:**
- `lat` (required): Latitude coordinate (number)
- `lng` (required): Longitude coordinate (number)  
- `emergency` (optional): Emergency type (string)
- `radius` (optional): Search radius in meters (number, default: 5000, max: 50000)

**Example Request:**
```
GET /api/hospitals/search?lat=28.7954&lng=77.5398&emergency=cardiac&radius=10000
```

## Successful Response Format (200 OK)

### Complete Response Structure
```json
{
  "message": "Emergency-capable hospitals retrieved successfully",
  "count": 25,
  "totalFound": 42,
  "hospitals": [
    {
      "placeId": "ChIJ1234567890abcdef",
      "name": "City General Hospital",
      "latitude": 28.7954,
      "longitude": 77.5398,
      "rating": 4.2,
      "address": "123 Hospital Street, Modinagar, UP",
      "emergencyServices": [
        "emergency_room",
        "cardiology",
        "trauma_center",
        "intensive_care"
      ],
      "distance": 2.5,
      "isOpen": true,
      "priceLevel": null,
      "photos": [
        {
          "photoReference": "places/ChIJ1234567890abcdef/photos/photo123",
          "width": 400,
          "height": 300
        }
      ],
      "emergencyCapabilityScore": 85,
      "emergencyFeatures": [
        "Hospital facility",
        "Emergency facility",
        "High patient rating (4.0+)",
        "Currently open/24-7 operations"
      ],
      "isEmergencyVerified": true,
      "recommendation": "Nearest available hospital - verify emergency capabilities"
    }
  ],
  "emergency": "cardiac",
  "searchRadius": "5000",
  "searchCriteria": {
    "minimumEmergencyScore": 25,
    "emergencyVerifiedOnly": false,
    "emergencyType": "cardiac"
  }
}
```

### Fallback Response (When No Verified Hospitals Found)
```json
{
  "message": "Emergency-capable hospitals retrieved successfully",
  "count": 5,
  "totalFound": 42,
  "hospitals": [
    {
      "placeId": "ChIJ9876543210zyxwvu",
      "name": "Nearby Medical Center",
      "latitude": 28.7850,
      "longitude": 77.5300,
      "rating": 3.8,
      "address": "456 Medical Road, Modinagar, UP",
      "emergencyServices": ["emergency_room"],
      "distance": 1.2,
      "isOpen": null,
      "priceLevel": null,
      "photos": [],
      "emergencyCapabilityScore": 12,
      "emergencyFeatures": ["Hospital facility"],
      "isEmergencyVerified": false,
      "recommendation": "Nearest available hospital - verify emergency capabilities"
    }
  ],
  "emergency": "cardiac",
  "searchRadius": "5000",
  "searchCriteria": {
    "minimumEmergencyScore": 25,
    "emergencyVerifiedOnly": false,
    "emergencyType": "cardiac",
    "fallbackToNearest": true
  }
}
```

## TypeScript Interface Definitions

### Main Response Interface
```typescript
interface HospitalSearchResponse {
  message: string;
  count: number;
  totalFound: number;
  hospitals: Hospital[];
  emergency: string | null;
  searchRadius: string;
  searchCriteria: SearchCriteria;
}

interface SearchCriteria {
  minimumEmergencyScore: number;
  emergencyVerifiedOnly: boolean;
  emergencyType: string;
  fallbackToNearest?: boolean;
}
```

### Hospital Object Interface
```typescript
interface Hospital {
  placeId: string;                    // Google Places ID
  name: string;                       // Hospital name
  latitude: number;                   // Latitude coordinate
  longitude: number;                  // Longitude coordinate
  rating: number | null;              // Google rating (1-5 scale)
  address: string;                    // Full formatted address
  emergencyServices: string[];        // Array of emergency services
  distance: number;                   // Distance in kilometers
  isOpen: boolean | null;             // Currently open status
  priceLevel: number | null;          // Price level (rarely available)
  photos: Photo[];                    // Array of photo objects
  emergencyCapabilityScore: number;   // Emergency capability score (0-100+)
  emergencyFeatures: string[];        // Array of emergency features
  isEmergencyVerified: boolean;       // Whether emergency capability is verified
  recommendation?: string;            // Optional recommendation text
}

interface Photo {
  photoReference: string;             // Photo reference for API calls
  width: number;                      // Photo width in pixels
  height: number;                     // Photo height in pixels
}
```

## Data Field Descriptions

### Response Metadata
- **message**: Success message indicating the operation completed
- **count**: Number of hospitals returned in the response
- **totalFound**: Total number of hospitals found before filtering
- **emergency**: The emergency type that was searched for (null if general search)
- **searchRadius**: Search radius in meters as a string
- **searchCriteria**: Object containing the filtering criteria used

### Hospital Data Fields

#### Core Information
- **placeId**: Unique Google Places identifier for the hospital
- **name**: Official name of the hospital
- **latitude/longitude**: Exact coordinates for mapping
- **address**: Full formatted address string
- **rating**: Google user rating (1.0-5.0 scale, null if unavailable)

#### Distance & Availability
- **distance**: Calculated distance from search center in kilometers (rounded to 2 decimal places)
- **isOpen**: Current open status (true/false/null if unknown)
- **priceLevel**: Price level indicator (rarely available for hospitals)

#### Emergency Capabilities
- **emergencyServices**: Array of available emergency services
- **emergencyCapabilityScore**: Calculated score (0-100+) based on emergency indicators
- **emergencyFeatures**: Human-readable list of emergency capabilities
- **isEmergencyVerified**: Boolean indicating if emergency capabilities are verified
- **recommendation**: Optional recommendation text (appears in fallback scenarios)

#### Visual Assets
- **photos**: Array of photo objects with references to hospital images

## Emergency Services Types

The `emergencyServices` array can contain these values:

### Primary Services
- `"emergency_room"` - General emergency department
- `"trauma_center"` - Trauma/accident care
- `"intensive_care"` - ICU facilities
- `"surgery"` - Surgical facilities

### Specialized Services
- `"cardiology"` - Heart/cardiac care
- `"neurology"` - Brain/neurological care
- `"pediatrics"` - Children's care
- `"obstetrics"` - Maternity/women's care
- `"psychiatry"` - Mental health care
- `"burn_unit"` - Burn treatment
- `"blood_bank"` - Blood services

## Emergency Types (Search Parameters)

Valid values for the `emergency` query parameter:

- `"cardiac"` - Heart-related emergencies
- `"trauma"` - Accident/injury emergencies
- `"respiratory"` - Breathing/lung emergencies
- `"neurological"` - Brain/nervous system emergencies
- `"pediatric"` - Children's emergencies
- `"obstetric"` - Pregnancy/childbirth emergencies
- `"psychiatric"` - Mental health emergencies
- `"burns"` - Burn injuries
- `"poisoning"` - Poison/toxin emergencies
- `"general"` - General emergency (or omit parameter)

## Emergency Capability Scoring

### Score Ranges
- **0-24**: Basic facility
- **25-49**: Good emergency capability
- **50-74**: High emergency capability
- **75+**: Excellent emergency capability

### Scoring Factors
- Hospital facility type: +20 points
- Emergency keywords in name: +25-40 points
- Medical center designation: +20 points
- Trauma level certification: +30-40 points
- Specialty relevance: +15 points per relevant specialty
- High rating (4.0+): +5-10 points
- 24/7 operations: +10 points

## Emergency Features Examples

Common values in the `emergencyFeatures` array:
- "Hospital facility"
- "Emergency facility"
- "Trauma facility"
- "Medical center facility"
- "Level 1 facility" / "Level 2 facility" / "Level 3 facility"
- "Comprehensive facility"
- "cardiac specialization" / "trauma specialization" / etc.
- "High patient rating (4.5+)"
- "Good patient rating (4.0+)"
- "Currently open/24-7 operations"

## Photo URL Construction

To display hospital photos, use the photo endpoint:

**GET** `/api/hospitals/photo/{photoReference}?maxwidth=400&maxheight=400`

Where:
- `{photoReference}` is the value from `photos[].photoReference`
- `maxwidth` and `maxheight` are optional size parameters

## Error Responses

### 400 Bad Request
```json
{
  "error": "Latitude and longitude are required"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to search hospitals: [error details]"
}
```

## Sorting Logic

Hospitals are sorted by the following priority:
1. **Emergency verified status** (verified hospitals first)
2. **Distance** (closest first)
3. **Emergency capability score** (highest first)
4. **Service relevance** (hospitals with relevant emergency services first)
5. **Alphabetical by name** (final fallback)

## Frontend Integration Examples

### JavaScript/React Example
```javascript
const searchHospitals = async (lat, lng, emergency = null, radius = 5000) => {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lng: lng.toString(),
    radius: radius.toString()
  });
  
  if (emergency) {
    params.append('emergency', emergency);
  }
  
  try {
    const response = await fetch(`/api/hospitals/search?${params}`);
    const data = await response.json();
    
    if (response.ok) {
      return {
        success: true,
        hospitals: data.hospitals,
        count: data.count,
        totalFound: data.totalFound,
        searchCriteria: data.searchCriteria
      };
    } else {
      return {
        success: false,
        error: data.error || 'Failed to search hospitals'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: 'Network error occurred'
    };
  }
};

// Usage
const result = await searchHospitals(28.7954, 77.5398, 'cardiac', 10000);
if (result.success) {
  console.log(`Found ${result.count} hospitals:`, result.hospitals);
} else {
  console.error('Error:', result.error);
}
```

### Display Hospital Photos
```javascript
const getHospitalPhotoUrl = (photoReference, width = 400, height = 400) => {
  return `/api/hospitals/photo/${encodeURIComponent(photoReference)}?maxwidth=${width}&maxheight=${height}`;
};

// Usage in React component
const HospitalCard = ({ hospital }) => (
  <div className="hospital-card">
    <h3>{hospital.name}</h3>
    <p>{hospital.address}</p>
    <p>Distance: {hospital.distance} km</p>
    <p>Rating: {hospital.rating || 'Not available'}</p>
    <p>Emergency Score: {hospital.emergencyCapabilityScore}</p>
    
    {hospital.photos.length > 0 && (
      <img 
        src={getHospitalPhotoUrl(hospital.photos[0].photoReference)}
        alt={hospital.name}
        width={hospital.photos[0].width}
        height={hospital.photos[0].height}
      />
    )}
    
    <div className="emergency-services">
      <strong>Emergency Services:</strong>
      <ul>
        {hospital.emergencyServices.map(service => (
          <li key={service}>{service.replace('_', ' ').toUpperCase()}</li>
        ))}
      </ul>
    </div>
    
    {hospital.emergencyFeatures.length > 0 && (
      <div className="emergency-features">
        <strong>Emergency Features:</strong>
        <ul>
          {hospital.emergencyFeatures.map(feature => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </div>
    )}
  </div>
);
```

## Notes for Frontend Developers

1. **Distance Filtering**: The API handles distance filtering server-side, so all returned hospitals are within the specified radius.

2. **Photo Handling**: Photos use the new Google Places API format. Use the photo endpoint to display images.

3. **Null Values**: Many fields can be `null` - handle these gracefully in your UI.

4. **Emergency Verification**: Use `isEmergencyVerified` to highlight truly verified emergency-capable hospitals.

5. **Fallback Behavior**: When no verified hospitals are found, the API returns the 5 closest hospitals with a recommendation message.

6. **Caching**: Consider caching results based on location and emergency type to improve performance.

7. **Error Handling**: Always handle both network errors and API error responses.

8. **Real-time Updates**: Hospital availability (`isOpen`) may change throughout the day.

## Last Updated
This documentation reflects the API implementation as of August 4, 2025.
