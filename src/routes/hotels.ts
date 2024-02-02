import express, { Request, Response } from "express";
import Hotel, { HotelType } from "../models/hotel";

const router = express.Router();

export type HotelSearchResponse = {
  data: HotelType[];
  pagination: {
    total: number;
    page: number;
    pages: number;
  };
};

// - /api/hotels/search -
router.get("/search", async (req: Request, res: Response) => {
  const query = constructSearchQuery(req.query);
  let sortOptions = {};
  switch (req.query.sortOption) {
    case "starRating":
      sortOptions = { starRating: -1 };
      break;
    case "pricePerNightAsc":
      sortOptions = { pricePerNight: 1 };
      break;
    case "pricePerNightDesc":
      sortOptions = { pricePerNight: -1 };
      break;
  }
  const { page } = req.query;
  const pageSize = 5;
  const pageNumber = parseInt(page ? page.toString() : "1");
  const skipSize = (pageNumber - 1) * pageSize;
  try {
    const hotels = await Hotel.find(query)
      .sort(sortOptions)
      .skip(skipSize)
      .limit(pageSize);
    const total = await Hotel.countDocuments(query);
    const result: HotelSearchResponse = {
      data: hotels,
      pagination: {
        total,
        page: pageNumber,
        pages: Math.ceil(total / pageSize),
      },
    };
    res.status(200).json(result);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Somthing went wrong" });
  }
});

const constructSearchQuery = (queryParams: any) => {
  let constructedQuery: any = {};
  if (queryParams.destination) {
    constructedQuery.$or = [
      { city: new RegExp(queryParams.destination, "i") },
      { country: new RegExp(queryParams.destination, "i") },
    ];
  }
  if (queryParams.adultCount) {
    constructedQuery.adultCount = {
      $gte: parseInt(queryParams.adultCount),
    };
  }
  if (queryParams.childCount) {
    constructedQuery.childCount = {
      $gte: parseInt(queryParams.childCount),
    };
  }
  if (queryParams.facilities) {
    constructedQuery.facilities = {
      $all: Array.isArray(queryParams.facilities)
        ? queryParams.facilities
        : [queryParams.facilities],
    };
  }
  if (queryParams.types) {
    constructedQuery.type = {
      $in: Array.isArray(queryParams.types)
        ? queryParams.types
        : [queryParams.types],
    };
  }
  if (queryParams.stars) {
    const starRatings = Array.isArray(queryParams.stars)
      ? queryParams.stars.map((star: string) => parseInt(star))
      : parseInt(queryParams.stars);

    constructedQuery.starRating = { $in: starRatings };
  }
  if (queryParams.maxPrice) {
    constructedQuery.pricePerNight = {
      $lte: parseInt(queryParams.maxPrice).toString(),
    };
  }
  return constructedQuery;
};

export default router;
