const Mess = require("../models/Mess");

const SORT_MAP = {
  rating: { avgRating: -1 },
  price: { avgPrice: 1 },
  newest: { createdAt: -1 },
};

/**
 * Find approved, active messes within `radiusKm` of [lng, lat].
 * Returns paginated results with distance in metres attached.
 */
const getNearbyMesses = async ({
  lat,
  lng,
  radiusKm = 5,
  sort = "rating",
  category,
  minRating,
  maxPrice,
  page = 1,
  limit = 10,
}) => {
  const skip = (page - 1) * limit;
  const radiusInMeters = parseFloat(radiusKm) * 1000;

  // 1. Build the Match Stage (Filters)
  const matchCriteria = {
    isApproved: true,
    isActive: true,
  };

  if (category) matchCriteria.category = category;
  if (minRating) matchCriteria.avgRating = { $gte: parseFloat(minRating) };
  if (maxPrice) matchCriteria.avgPrice = { $lte: parseFloat(maxPrice) };

  // 2. Define the Aggregation Pipeline
  const pipeline = [
    {
      // $geoNear MUST be the first stage
      $geoNear: {
        near: {
          type: "Point",
          coordinates: [parseFloat(lng), parseFloat(lat)],
        },
        distanceField: "distance", // This adds the distance to each document
        maxDistance: radiusInMeters,
        spherical: true,
        query: matchCriteria, // Filters applied DURING the geo-search for efficiency
      },
    },
  ];

  // 3. Apply Custom Sorting
  // If user wants distance, $geoNear already did it.
  // If user wants "rating", we override here.
  const sortStage = {};
  if (sort === "rating") {
    sortStage.avgRating = -1;
  } else if (sort === "price") {
    sortStage.avgPrice = 1;
  } else {
    sortStage.distance = 1; // Default to nearest
  }
  pipeline.push({ $sort: sortStage });

  // 4. Use $facet to get both data and total count in one go (Efficient!)
  const result = await Mess.aggregate([
    ...pipeline,
    {
      $facet: {
        metadata: [{ $count: "total" }],
        data: [
          { $skip: skip },
          { $limit: limit },
          // Manual population since .populate() doesn't work on aggregations
          {
            $lookup: {
              from: "users", // ensure this matches your User collection name
              localField: "owner",
              foreignField: "_id",
              as: "owner",
            },
          },
          { $unwind: "$owner" },
          {
            $project: {
              "owner.password": 0, // Exclude sensitive info
              "owner.email": 0,
            },
          },
        ],
      },
    },
  ]);

  const messes = result[0].data;
  const total = result[0].metadata[0]?.total || 0;

  return {
    messes,
    total,
    page,
    pages: Math.ceil(total / limit),
  };
};

/**
 * Fetch multiple messes by id and build a comparison payload.
 * Returns normalised objects suitable for a side-by-side table.
 */
const compareMesses = async (ids) => {
  const MenuItem = require("../models/MenuItem");

  const messes = await Mess.find({
    _id: { $in: ids },
    isApproved: true,
    isActive: true,
  })
    .populate("owner", "name phone")
    .lean();

  const results = await Promise.all(
    messes.map(async (m) => {
      const menuItems = await MenuItem.find({
        mess: m._id,
        isAvailable: true,
      }).lean();
      const specialItems = menuItems.filter((i) => i.isSpecial).slice(0, 5);

      return {
        id: m._id,
        name: m.name,
        category: m.category,
        avgRating: m.avgRating,
        totalReviews: m.totalReviews,
        avgPrice: m.avgPrice,
        timings: m.timings,
        daysOpen: m.daysOpen,
        amenities: m.amenities,
        address: m.address,
        owner: m.owner,
        specialItems,
        totalMenuItems: menuItems.length,
        priceRange: menuItems.length
          ? {
              min: Math.min(...menuItems.map((i) => i.price)),
              max: Math.max(...menuItems.map((i) => i.price)),
            }
          : null,
      };
    }),
  );

  return results;
};

/**
 * Full-text search on mess name / description / tags.
 */
const searchMesses = async ({ query, page = 1, limit = 10 }) => {
  const filter = {
    isApproved: true,
    isActive: true,
    $text: { $search: query },
  };

  const skip = (page - 1) * limit;

  const [messes, total] = await Promise.all([
    Mess.find(filter, { score: { $meta: "textScore" } })
      .sort({ score: { $meta: "textScore" } })
      .skip(skip)
      .limit(limit)
      .populate("owner", "name phone avatar")
      .lean(),
    Mess.countDocuments(filter),
  ]);

  return { messes, total, page, pages: Math.ceil(total / limit) };
};

module.exports = { getNearbyMesses, compareMesses, searchMesses };
