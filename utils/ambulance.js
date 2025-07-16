export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const calculateFare = (distance, ambulanceType = null, hospitalFareFormula = null) => {
  const rateStructure = {
    bls: { baseFare: 50, perKmRate: 15, minimumFare: 100 }, // Basic Life Support
    als: { baseFare: 80, perKmRate: 20, minimumFare: 150 }, // Advanced Life Support
    ccs: { baseFare: 120, perKmRate: 30, minimumFare: 200 }, // Critical Care Support
    auto: { baseFare: 40, perKmRate: 12, minimumFare: 80 }, // Auto Ambulance
    bike: { baseFare: 30, perKmRate: 10, minimumFare: 60 }, // Bike Safety Unit
  };

  const fareCalculation = (baseFare, perKmRate, minimumFare) => {
    const calculatedFare = baseFare + distance * perKmRate;
    return Math.max(calculatedFare, minimumFare);
  };

  // If hospital fare formula is provided
  if (hospitalFareFormula && ambulanceType) {
    return {
      [ambulanceType]: fareCalculation(
        hospitalFareFormula.baseFare || rateStructure[ambulanceType].baseFare,
        hospitalFareFormula.perKmRate || rateStructure[ambulanceType].perKmRate,
        hospitalFareFormula.minimumFare || rateStructure[ambulanceType].minimumFare
      )
    };
  }

  // Calculate fare for all ambulance types (independent drivers)
  return {
    bls: fareCalculation(
      rateStructure.bls.baseFare,
      rateStructure.bls.perKmRate,
      rateStructure.bls.minimumFare
    ),
    als: fareCalculation(
      rateStructure.als.baseFare,
      rateStructure.als.perKmRate,
      rateStructure.als.minimumFare
    ),
    ccs: fareCalculation(
      rateStructure.ccs.baseFare,
      rateStructure.ccs.perKmRate,
      rateStructure.ccs.minimumFare
    ),
    auto: fareCalculation(
      rateStructure.auto.baseFare,
      rateStructure.auto.perKmRate,
      rateStructure.auto.minimumFare
    ),
    bike: fareCalculation(
      rateStructure.bike.baseFare,
      rateStructure.bike.perKmRate,
      rateStructure.bike.minimumFare
    ),
  };
};

export const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// Helper function to get recommended ambulance types based on emergency
export const getRecommendedAmbulanceType = (emergencyType, emergencyPriority) => {
  const emergencyAmbulanceMap = {
    cardiac: {
      critical: 'ccs', // Critical Care Support for severe cardiac events
      high: 'als',     // Advanced Life Support for serious cardiac issues
      medium: 'als',   // Advanced Life Support for moderate cardiac issues
      low: 'bls'       // Basic Life Support for minor cardiac issues
    },
    trauma: {
      critical: 'ccs', // Critical Care for severe trauma
      high: 'als',     // Advanced Life Support for serious trauma
      medium: 'als',   // Advanced Life Support for moderate trauma
      low: 'bls'       // Basic Life Support for minor trauma
    },
    respiratory: {
      critical: 'ccs', // Critical Care for severe respiratory distress
      high: 'als',     // Advanced Life Support for serious breathing problems
      medium: 'als',   // Advanced Life Support for moderate respiratory issues
      low: 'bls'       // Basic Life Support for minor breathing problems
    },
    neurological: {
      critical: 'ccs', // Critical Care for stroke, severe neurological events
      high: 'als',     // Advanced Life Support for serious neurological issues
      medium: 'als',   // Advanced Life Support for moderate neurological issues
      low: 'bls'       // Basic Life Support for minor neurological issues
    },
    pediatric: {
      critical: 'ccs', // Critical Care for critically ill children
      high: 'als',     // Advanced Life Support for sick children
      medium: 'als',   // Advanced Life Support for moderately ill children
      low: 'bls'       // Basic Life Support for minor pediatric issues
    },
    obstetric: {
      critical: 'ccs', // Critical Care for high-risk deliveries/complications
      high: 'als',     // Advanced Life Support for delivery complications
      medium: 'als',   // Advanced Life Support for labor transport
      low: 'bls'       // Basic Life Support for routine maternity transport
    },
    psychiatric: {
      critical: 'als', // Advanced Life Support for psychiatric emergencies
      high: 'als',     // Advanced Life Support for agitated patients
      medium: 'bls',   // Basic Life Support for stable psychiatric transport
      low: 'bls'       // Basic Life Support for routine psychiatric transport
    },
    burns: {
      critical: 'ccs', // Critical Care for severe burns
      high: 'als',     // Advanced Life Support for serious burns
      medium: 'als',   // Advanced Life Support for moderate burns
      low: 'bls'       // Basic Life Support for minor burns
    },
    poisoning: {
      critical: 'ccs', // Critical Care for severe poisoning
      high: 'als',     // Advanced Life Support for serious poisoning
      medium: 'als',   // Advanced Life Support for moderate poisoning
      low: 'bls'       // Basic Life Support for minor poisoning
    },
    general: {
      critical: 'als', // Advanced Life Support for unknown critical emergencies
      high: 'als',     // Advanced Life Support for serious general emergencies
      medium: 'bls',   // Basic Life Support for moderate general issues
      low: 'bls'       // Basic Life Support for minor general issues
    }
  };

  // Special cases for urban/traffic scenarios
  const urbanTypes = ['auto', 'bike']; // These can be recommended for quick response in traffic

  if (!emergencyType || !emergencyAmbulanceMap[emergencyType]) {
    return emergencyPriority === 'critical' ? 'als' : 'bls';
  }

  const recommendedType = emergencyAmbulanceMap[emergencyType][emergencyPriority] || 'bls';
  
  return {
    primary: recommendedType,
    alternatives: urbanTypes, // Auto and bike ambulances for quick response
    description: getAmbulanceTypeDescription(recommendedType)
  };
};

// Helper function to get ambulance type descriptions
export const getAmbulanceTypeDescription = (type) => {
  const descriptions = {
    bls: 'Basic Life Support - Standard ambulance with essential medical equipment',
    als: 'Advanced Life Support - Advanced medical equipment and cardiac monitoring',
    ccs: 'Critical Care Support - ICU-level equipment for critically ill patients',
    auto: 'Auto Ambulance - Compact design for urban areas and traffic-congested zones',
    bike: 'Bike Safety Unit - Rapid response motorcycle for quick assessment and first aid'
  };
  
  return descriptions[type] || 'Medical transport vehicle';
};
