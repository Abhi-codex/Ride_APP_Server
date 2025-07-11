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
  // Default rate structure for independent drivers
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

  // If hospital fare formula is provided (for affiliated drivers), use it for specific ambulance type
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
