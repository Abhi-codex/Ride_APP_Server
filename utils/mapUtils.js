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

export const calculateFare = (distance) => {
  const rateStructure = {
    basicAmbulance: { baseFare: 50, perKmRate: 15, minimumFare: 100 },
    advancedAmbulance: { baseFare: 80, perKmRate: 20, minimumFare: 150 },
    icuAmbulance: { baseFare: 120, perKmRate: 30, minimumFare: 200 },
    airAmbulance: { baseFare: 500, perKmRate: 100, minimumFare: 800 },
  };

  const fareCalculation = (baseFare, perKmRate, minimumFare) => {
    const calculatedFare = baseFare + distance * perKmRate;
    return Math.max(calculatedFare, minimumFare);
  };

  return {
    basicAmbulance: fareCalculation(
      rateStructure.basicAmbulance.baseFare,
      rateStructure.basicAmbulance.perKmRate,
      rateStructure.basicAmbulance.minimumFare
    ),
    advancedAmbulance: fareCalculation(
      rateStructure.advancedAmbulance.baseFare,
      rateStructure.advancedAmbulance.perKmRate,
      rateStructure.advancedAmbulance.minimumFare
    ),
    icuAmbulance: fareCalculation(
      rateStructure.icuAmbulance.baseFare,
      rateStructure.icuAmbulance.perKmRate,
      rateStructure.icuAmbulance.minimumFare
    ),
    airAmbulance: fareCalculation(
      rateStructure.airAmbulance.baseFare,
      rateStructure.airAmbulance.perKmRate,
      rateStructure.airAmbulance.minimumFare
    ),
  };
};

export const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};
