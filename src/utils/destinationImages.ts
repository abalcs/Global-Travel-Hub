/**
 * Destination Images Utility
 *
 * Provides travel-themed images for destinations using:
 * 1. Curated mappings for common destinations (no API key needed)
 * 2. Pexels API for dynamic searches (optional, requires API key)
 */

// Image result type
export interface DestinationImage {
  url: string;
  photographer?: string;
  alt: string;
  source: 'curated' | 'pexels-api' | 'fallback';
}

// Curated destination images from Pexels (verified working, no API key needed)
// Format: keyword patterns -> image URL
const CURATED_DESTINATIONS: Record<string, string> = {
  // Countries - Europe
  'italy': 'https://images.pexels.com/photos/1701595/pexels-photo-1701595.jpeg?auto=compress&cs=tinysrgb&w=800',
  'france': 'https://images.pexels.com/photos/338515/pexels-photo-338515.jpeg?auto=compress&cs=tinysrgb&w=800',
  'spain': 'https://images.pexels.com/photos/1388030/pexels-photo-1388030.jpeg?auto=compress&cs=tinysrgb&w=800',
  'greece': 'https://images.pexels.com/photos/1285625/pexels-photo-1285625.jpeg?auto=compress&cs=tinysrgb&w=800',
  'portugal': 'https://images.pexels.com/photos/2867744/pexels-photo-2867744.jpeg?auto=compress&cs=tinysrgb&w=800',
  'croatia': 'https://images.pexels.com/photos/2044434/pexels-photo-2044434.jpeg?auto=compress&cs=tinysrgb&w=800',
  'iceland': 'https://images.pexels.com/photos/2113566/pexels-photo-2113566.jpeg?auto=compress&cs=tinysrgb&w=800',
  'norway': 'https://images.pexels.com/photos/1559821/pexels-photo-1559821.jpeg?auto=compress&cs=tinysrgb&w=800',
  'sweden': 'https://images.pexels.com/photos/1534560/pexels-photo-1534560.jpeg?auto=compress&cs=tinysrgb&w=800',
  'switzerland': 'https://images.pexels.com/photos/1586298/pexels-photo-1586298.jpeg?auto=compress&cs=tinysrgb&w=800',
  'austria': 'https://images.pexels.com/photos/2929906/pexels-photo-2929906.jpeg?auto=compress&cs=tinysrgb&w=800',
  'germany': 'https://images.pexels.com/photos/109629/pexels-photo-109629.jpeg?auto=compress&cs=tinysrgb&w=800',
  'ireland': 'https://images.pexels.com/photos/2382681/pexels-photo-2382681.jpeg?auto=compress&cs=tinysrgb&w=800',
  'scotland': 'https://images.pexels.com/photos/1660995/pexels-photo-1660995.jpeg?auto=compress&cs=tinysrgb&w=800',
  'england': 'https://images.pexels.com/photos/672532/pexels-photo-672532.jpeg?auto=compress&cs=tinysrgb&w=800',
  'uk': 'https://images.pexels.com/photos/672532/pexels-photo-672532.jpeg?auto=compress&cs=tinysrgb&w=800',
  'netherlands': 'https://images.pexels.com/photos/2031706/pexels-photo-2031706.jpeg?auto=compress&cs=tinysrgb&w=800',
  'belgium': 'https://images.pexels.com/photos/2693529/pexels-photo-2693529.jpeg?auto=compress&cs=tinysrgb&w=800',
  'czech': 'https://images.pexels.com/photos/2346216/pexels-photo-2346216.jpeg?auto=compress&cs=tinysrgb&w=800',
  'prague': 'https://images.pexels.com/photos/2346216/pexels-photo-2346216.jpeg?auto=compress&cs=tinysrgb&w=800',
  'hungary': 'https://images.pexels.com/photos/351283/pexels-photo-351283.jpeg?auto=compress&cs=tinysrgb&w=800',
  'poland': 'https://images.pexels.com/photos/3649116/pexels-photo-3649116.jpeg?auto=compress&cs=tinysrgb&w=800',
  'turkey': 'https://images.pexels.com/photos/3889843/pexels-photo-3889843.jpeg?auto=compress&cs=tinysrgb&w=800',

  // Cities - Europe
  'paris': 'https://images.pexels.com/photos/338515/pexels-photo-338515.jpeg?auto=compress&cs=tinysrgb&w=800',
  'rome': 'https://images.pexels.com/photos/2064827/pexels-photo-2064827.jpeg?auto=compress&cs=tinysrgb&w=800',
  'venice': 'https://images.pexels.com/photos/1796715/pexels-photo-1796715.jpeg?auto=compress&cs=tinysrgb&w=800',
  'florence': 'https://images.pexels.com/photos/2422259/pexels-photo-2422259.jpeg?auto=compress&cs=tinysrgb&w=800',
  'barcelona': 'https://images.pexels.com/photos/1388030/pexels-photo-1388030.jpeg?auto=compress&cs=tinysrgb&w=800',
  'amsterdam': 'https://images.pexels.com/photos/2031706/pexels-photo-2031706.jpeg?auto=compress&cs=tinysrgb&w=800',
  'london': 'https://images.pexels.com/photos/672532/pexels-photo-672532.jpeg?auto=compress&cs=tinysrgb&w=800',
  'edinburgh': 'https://images.pexels.com/photos/1660995/pexels-photo-1660995.jpeg?auto=compress&cs=tinysrgb&w=800',
  'lisbon': 'https://images.pexels.com/photos/2867744/pexels-photo-2867744.jpeg?auto=compress&cs=tinysrgb&w=800',
  'vienna': 'https://images.pexels.com/photos/2929906/pexels-photo-2929906.jpeg?auto=compress&cs=tinysrgb&w=800',
  'munich': 'https://images.pexels.com/photos/109629/pexels-photo-109629.jpeg?auto=compress&cs=tinysrgb&w=800',
  'dublin': 'https://images.pexels.com/photos/2382681/pexels-photo-2382681.jpeg?auto=compress&cs=tinysrgb&w=800',
  'santorini': 'https://images.pexels.com/photos/1285625/pexels-photo-1285625.jpeg?auto=compress&cs=tinysrgb&w=800',
  'amalfi': 'https://images.pexels.com/photos/4846097/pexels-photo-4846097.jpeg?auto=compress&cs=tinysrgb&w=800',
  'tuscany': 'https://images.pexels.com/photos/1701595/pexels-photo-1701595.jpeg?auto=compress&cs=tinysrgb&w=800',
  'provence': 'https://images.pexels.com/photos/1595104/pexels-photo-1595104.jpeg?auto=compress&cs=tinysrgb&w=800',

  // Africa - Safari
  'africa': 'https://images.pexels.com/photos/631317/pexels-photo-631317.jpeg?auto=compress&cs=tinysrgb&w=800',
  'safari': 'https://images.pexels.com/photos/631317/pexels-photo-631317.jpeg?auto=compress&cs=tinysrgb&w=800',
  'kenya': 'https://images.pexels.com/photos/631317/pexels-photo-631317.jpeg?auto=compress&cs=tinysrgb&w=800',
  'tanzania': 'https://images.pexels.com/photos/3935702/pexels-photo-3935702.jpeg?auto=compress&cs=tinysrgb&w=800',
  'south africa': 'https://images.pexels.com/photos/259547/pexels-photo-259547.jpeg?auto=compress&cs=tinysrgb&w=800',
  'botswana': 'https://images.pexels.com/photos/1170572/pexels-photo-1170572.jpeg?auto=compress&cs=tinysrgb&w=800',
  'namibia': 'https://images.pexels.com/photos/3935702/pexels-photo-3935702.jpeg?auto=compress&cs=tinysrgb&w=800',
  'zimbabwe': 'https://images.pexels.com/photos/1170572/pexels-photo-1170572.jpeg?auto=compress&cs=tinysrgb&w=800',
  'rwanda': 'https://images.pexels.com/photos/2062316/pexels-photo-2062316.jpeg?auto=compress&cs=tinysrgb&w=800',
  'uganda': 'https://images.pexels.com/photos/2062316/pexels-photo-2062316.jpeg?auto=compress&cs=tinysrgb&w=800',
  'morocco': 'https://images.pexels.com/photos/3889843/pexels-photo-3889843.jpeg?auto=compress&cs=tinysrgb&w=800',
  'egypt': 'https://images.pexels.com/photos/3689859/pexels-photo-3689859.jpeg?auto=compress&cs=tinysrgb&w=800',
  'cape town': 'https://images.pexels.com/photos/259547/pexels-photo-259547.jpeg?auto=compress&cs=tinysrgb&w=800',
  'serengeti': 'https://images.pexels.com/photos/631317/pexels-photo-631317.jpeg?auto=compress&cs=tinysrgb&w=800',
  'kruger': 'https://images.pexels.com/photos/1170572/pexels-photo-1170572.jpeg?auto=compress&cs=tinysrgb&w=800',
  'victoria falls': 'https://images.pexels.com/photos/1170572/pexels-photo-1170572.jpeg?auto=compress&cs=tinysrgb&w=800',

  // Asia
  'japan': 'https://images.pexels.com/photos/1440476/pexels-photo-1440476.jpeg?auto=compress&cs=tinysrgb&w=800',
  'tokyo': 'https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=800',
  'kyoto': 'https://images.pexels.com/photos/1440476/pexels-photo-1440476.jpeg?auto=compress&cs=tinysrgb&w=800',
  'thailand': 'https://images.pexels.com/photos/1659438/pexels-photo-1659438.jpeg?auto=compress&cs=tinysrgb&w=800',
  'bali': 'https://images.pexels.com/photos/2166559/pexels-photo-2166559.jpeg?auto=compress&cs=tinysrgb&w=800',
  'indonesia': 'https://images.pexels.com/photos/2166559/pexels-photo-2166559.jpeg?auto=compress&cs=tinysrgb&w=800',
  'vietnam': 'https://images.pexels.com/photos/2161467/pexels-photo-2161467.jpeg?auto=compress&cs=tinysrgb&w=800',
  'cambodia': 'https://images.pexels.com/photos/2166553/pexels-photo-2166553.jpeg?auto=compress&cs=tinysrgb&w=800',
  'india': 'https://images.pexels.com/photos/1603650/pexels-photo-1603650.jpeg?auto=compress&cs=tinysrgb&w=800',
  'china': 'https://images.pexels.com/photos/2412603/pexels-photo-2412603.jpeg?auto=compress&cs=tinysrgb&w=800',
  'singapore': 'https://images.pexels.com/photos/1842332/pexels-photo-1842332.jpeg?auto=compress&cs=tinysrgb&w=800',
  'hong kong': 'https://images.pexels.com/photos/1440476/pexels-photo-1440476.jpeg?auto=compress&cs=tinysrgb&w=800',
  'maldives': 'https://images.pexels.com/photos/1287460/pexels-photo-1287460.jpeg?auto=compress&cs=tinysrgb&w=800',
  'sri lanka': 'https://images.pexels.com/photos/2166559/pexels-photo-2166559.jpeg?auto=compress&cs=tinysrgb&w=800',
  'nepal': 'https://images.pexels.com/photos/2104882/pexels-photo-2104882.jpeg?auto=compress&cs=tinysrgb&w=800',
  'bhutan': 'https://images.pexels.com/photos/2104882/pexels-photo-2104882.jpeg?auto=compress&cs=tinysrgb&w=800',

  // Oceania
  'australia': 'https://images.pexels.com/photos/1878293/pexels-photo-1878293.jpeg?auto=compress&cs=tinysrgb&w=800',
  'new zealand': 'https://images.pexels.com/photos/1659437/pexels-photo-1659437.jpeg?auto=compress&cs=tinysrgb&w=800',
  'fiji': 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg?auto=compress&cs=tinysrgb&w=800',
  'tahiti': 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg?auto=compress&cs=tinysrgb&w=800',
  'sydney': 'https://images.pexels.com/photos/1878293/pexels-photo-1878293.jpeg?auto=compress&cs=tinysrgb&w=800',
  'queensland': 'https://images.pexels.com/photos/1878293/pexels-photo-1878293.jpeg?auto=compress&cs=tinysrgb&w=800',

  // Americas
  'usa': 'https://images.pexels.com/photos/466685/pexels-photo-466685.jpeg?auto=compress&cs=tinysrgb&w=800',
  'america': 'https://images.pexels.com/photos/466685/pexels-photo-466685.jpeg?auto=compress&cs=tinysrgb&w=800',
  'canada': 'https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg?auto=compress&cs=tinysrgb&w=800',
  'mexico': 'https://images.pexels.com/photos/3648269/pexels-photo-3648269.jpeg?auto=compress&cs=tinysrgb&w=800',
  'peru': 'https://images.pexels.com/photos/2356045/pexels-photo-2356045.jpeg?auto=compress&cs=tinysrgb&w=800',
  'machu picchu': 'https://images.pexels.com/photos/2356045/pexels-photo-2356045.jpeg?auto=compress&cs=tinysrgb&w=800',
  'argentina': 'https://images.pexels.com/photos/2356087/pexels-photo-2356087.jpeg?auto=compress&cs=tinysrgb&w=800',
  'brazil': 'https://images.pexels.com/photos/2868242/pexels-photo-2868242.jpeg?auto=compress&cs=tinysrgb&w=800',
  'chile': 'https://images.pexels.com/photos/2356087/pexels-photo-2356087.jpeg?auto=compress&cs=tinysrgb&w=800',
  'costa rica': 'https://images.pexels.com/photos/2739013/pexels-photo-2739013.jpeg?auto=compress&cs=tinysrgb&w=800',
  'ecuador': 'https://images.pexels.com/photos/2739013/pexels-photo-2739013.jpeg?auto=compress&cs=tinysrgb&w=800',
  'galapagos': 'https://images.pexels.com/photos/2739013/pexels-photo-2739013.jpeg?auto=compress&cs=tinysrgb&w=800',
  'colombia': 'https://images.pexels.com/photos/2739013/pexels-photo-2739013.jpeg?auto=compress&cs=tinysrgb&w=800',
  'patagonia': 'https://images.pexels.com/photos/2356087/pexels-photo-2356087.jpeg?auto=compress&cs=tinysrgb&w=800',
  'new york': 'https://images.pexels.com/photos/466685/pexels-photo-466685.jpeg?auto=compress&cs=tinysrgb&w=800',
  'hawaii': 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg?auto=compress&cs=tinysrgb&w=800',
  'alaska': 'https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg?auto=compress&cs=tinysrgb&w=800',
  'california': 'https://images.pexels.com/photos/1388030/pexels-photo-1388030.jpeg?auto=compress&cs=tinysrgb&w=800',

  // Caribbean
  'caribbean': 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg?auto=compress&cs=tinysrgb&w=800',
  'bahamas': 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg?auto=compress&cs=tinysrgb&w=800',
  'jamaica': 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg?auto=compress&cs=tinysrgb&w=800',
  'barbados': 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg?auto=compress&cs=tinysrgb&w=800',
  'aruba': 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg?auto=compress&cs=tinysrgb&w=800',
  'turks': 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg?auto=compress&cs=tinysrgb&w=800',
  'caicos': 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg?auto=compress&cs=tinysrgb&w=800',
  'st lucia': 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg?auto=compress&cs=tinysrgb&w=800',
  'virgin islands': 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg?auto=compress&cs=tinysrgb&w=800',
  'cuba': 'https://images.pexels.com/photos/3601422/pexels-photo-3601422.jpeg?auto=compress&cs=tinysrgb&w=800',

  // Middle East
  'dubai': 'https://images.pexels.com/photos/1470502/pexels-photo-1470502.jpeg?auto=compress&cs=tinysrgb&w=800',
  'uae': 'https://images.pexels.com/photos/1470502/pexels-photo-1470502.jpeg?auto=compress&cs=tinysrgb&w=800',
  'israel': 'https://images.pexels.com/photos/2087391/pexels-photo-2087391.jpeg?auto=compress&cs=tinysrgb&w=800',
  'jordan': 'https://images.pexels.com/photos/1631665/pexels-photo-1631665.jpeg?auto=compress&cs=tinysrgb&w=800',
  'petra': 'https://images.pexels.com/photos/1631665/pexels-photo-1631665.jpeg?auto=compress&cs=tinysrgb&w=800',
  'oman': 'https://images.pexels.com/photos/1470502/pexels-photo-1470502.jpeg?auto=compress&cs=tinysrgb&w=800',

  // Generic travel themes
  'beach': 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg?auto=compress&cs=tinysrgb&w=800',
  'mountain': 'https://images.pexels.com/photos/417074/pexels-photo-417074.jpeg?auto=compress&cs=tinysrgb&w=800',
  'city': 'https://images.pexels.com/photos/466685/pexels-photo-466685.jpeg?auto=compress&cs=tinysrgb&w=800',
  'island': 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg?auto=compress&cs=tinysrgb&w=800',
  'cruise': 'https://images.pexels.com/photos/813011/pexels-photo-813011.jpeg?auto=compress&cs=tinysrgb&w=800',
  'adventure': 'https://images.pexels.com/photos/2356045/pexels-photo-2356045.jpeg?auto=compress&cs=tinysrgb&w=800',
  'luxury': 'https://images.pexels.com/photos/1287460/pexels-photo-1287460.jpeg?auto=compress&cs=tinysrgb&w=800',
  'honeymoon': 'https://images.pexels.com/photos/1287460/pexels-photo-1287460.jpeg?auto=compress&cs=tinysrgb&w=800',
  'wildlife': 'https://images.pexels.com/photos/631317/pexels-photo-631317.jpeg?auto=compress&cs=tinysrgb&w=800',
  'river': 'https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg?auto=compress&cs=tinysrgb&w=800',
  'lake': 'https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg?auto=compress&cs=tinysrgb&w=800',
  'desert': 'https://images.pexels.com/photos/3889843/pexels-photo-3889843.jpeg?auto=compress&cs=tinysrgb&w=800',
  'rainforest': 'https://images.pexels.com/photos/2739013/pexels-photo-2739013.jpeg?auto=compress&cs=tinysrgb&w=800',
  'jungle': 'https://images.pexels.com/photos/2739013/pexels-photo-2739013.jpeg?auto=compress&cs=tinysrgb&w=800',
  'wine': 'https://images.pexels.com/photos/1595104/pexels-photo-1595104.jpeg?auto=compress&cs=tinysrgb&w=800',
  'golf': 'https://images.pexels.com/photos/1388030/pexels-photo-1388030.jpeg?auto=compress&cs=tinysrgb&w=800',
  'ski': 'https://images.pexels.com/photos/1586298/pexels-photo-1586298.jpeg?auto=compress&cs=tinysrgb&w=800',
  'spa': 'https://images.pexels.com/photos/1287460/pexels-photo-1287460.jpeg?auto=compress&cs=tinysrgb&w=800',
};

// Fallback images for when no match is found
const FALLBACK_IMAGES = [
  'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg?auto=compress&cs=tinysrgb&w=800', // Beach
  'https://images.pexels.com/photos/417074/pexels-photo-417074.jpeg?auto=compress&cs=tinysrgb&w=800',  // Mountains
  'https://images.pexels.com/photos/631317/pexels-photo-631317.jpeg?auto=compress&cs=tinysrgb&w=800',  // Safari
  'https://images.pexels.com/photos/1701595/pexels-photo-1701595.jpeg?auto=compress&cs=tinysrgb&w=800', // Italy
  'https://images.pexels.com/photos/338515/pexels-photo-338515.jpeg?auto=compress&cs=tinysrgb&w=800',  // Paris
];

// Cache for API results
const imageCache = new Map<string, DestinationImage>();

/**
 * Find a curated image for a destination
 */
export const findCuratedImage = (destination: string): DestinationImage | null => {
  const searchTerm = destination.toLowerCase().trim();

  // Check cache first
  const cached = imageCache.get(searchTerm);
  if (cached && cached.source === 'curated') {
    return cached;
  }

  // Try exact match first
  if (CURATED_DESTINATIONS[searchTerm]) {
    const result: DestinationImage = {
      url: CURATED_DESTINATIONS[searchTerm],
      alt: destination,
      source: 'curated',
    };
    imageCache.set(searchTerm, result);
    return result;
  }

  // Try partial match (destination contains keyword or keyword contains destination)
  for (const [keyword, url] of Object.entries(CURATED_DESTINATIONS)) {
    if (searchTerm.includes(keyword) || keyword.includes(searchTerm)) {
      const result: DestinationImage = {
        url,
        alt: destination,
        source: 'curated',
      };
      imageCache.set(searchTerm, result);
      return result;
    }
  }

  return null;
};

/**
 * Get a fallback image (used when no curated or API match)
 */
export const getFallbackImage = (index: number = 0): DestinationImage => {
  return {
    url: FALLBACK_IMAGES[index % FALLBACK_IMAGES.length],
    alt: 'Travel destination',
    source: 'fallback',
  };
};

/**
 * Search Pexels API for destination images (requires API key)
 */
export const searchPexelsImage = async (
  destination: string,
  apiKey: string
): Promise<DestinationImage | null> => {
  const searchTerm = destination.toLowerCase().trim();

  // Check cache first
  const cached = imageCache.get(`pexels:${searchTerm}`);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(destination + ' travel landscape')}&per_page=1&orientation=landscape`,
      {
        headers: {
          Authorization: apiKey,
        },
      }
    );

    if (!response.ok) {
      console.warn(`Pexels API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.photos && data.photos.length > 0) {
      const photo = data.photos[0];
      const result: DestinationImage = {
        url: photo.src.large || photo.src.medium,
        photographer: photo.photographer,
        alt: photo.alt || destination,
        source: 'pexels-api',
      };
      imageCache.set(`pexels:${searchTerm}`, result);
      return result;
    }

    return null;
  } catch (error) {
    console.warn('Pexels API error:', error);
    return null;
  }
};

/**
 * Get image for a destination using hybrid approach:
 * 1. Try curated mapping first
 * 2. If Pexels API key provided, try API
 * 3. Fall back to generic travel image
 */
export const getDestinationImage = async (
  destination: string,
  pexelsApiKey?: string
): Promise<DestinationImage> => {
  // Try curated first
  const curated = findCuratedImage(destination);
  if (curated) {
    return curated;
  }

  // Try Pexels API if key provided
  if (pexelsApiKey) {
    const apiResult = await searchPexelsImage(destination, pexelsApiKey);
    if (apiResult) {
      return apiResult;
    }
  }

  // Return fallback
  return getFallbackImage(destination.length); // Use destination length for some variety
};

/**
 * Get images for multiple destinations
 */
export const getDestinationImages = async (
  destinations: string[],
  pexelsApiKey?: string
): Promise<Map<string, DestinationImage>> => {
  const results = new Map<string, DestinationImage>();

  // Process in parallel but with some rate limiting for API calls
  const promises = destinations.map(async (dest, index) => {
    // Add small delay for API calls to avoid rate limiting
    if (pexelsApiKey && !findCuratedImage(dest)) {
      await new Promise(resolve => setTimeout(resolve, index * 100));
    }
    const image = await getDestinationImage(dest, pexelsApiKey);
    results.set(dest, image);
  });

  await Promise.all(promises);
  return results;
};

/**
 * Preload images for faster display
 */
export const preloadImages = (urls: string[]): void => {
  urls.forEach(url => {
    const img = new Image();
    img.src = url;
  });
};

/**
 * Get the Pexels API key from localStorage
 */
export const getPexelsApiKey = (): string | null => {
  try {
    return localStorage.getItem('pexels-api-key');
  } catch {
    return null;
  }
};

/**
 * Save Pexels API key to localStorage
 */
export const savePexelsApiKey = (apiKey: string): void => {
  try {
    localStorage.setItem('pexels-api-key', apiKey);
  } catch {
    console.warn('Could not save Pexels API key to localStorage');
  }
};

/**
 * Clear the Pexels API key from localStorage
 */
export const clearPexelsApiKey = (): void => {
  try {
    localStorage.removeItem('pexels-api-key');
  } catch {
    // Ignore errors
  }
};
