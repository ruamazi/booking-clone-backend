import express, { Request, Response } from "express";
import Hotel, { BookingType, HotelType } from "../models/hotel";
import Stripe from "stripe";
import verifyToken from "../middleware/verifyToken";

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_API_KEY as string);

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

router.get("/", async (req: Request, res: Response) => {
  try {
    const hotels = await Hotel.find().sort("-lastUpdated");
    res.json(hotels);
  } catch (err) {
    console.log("error", err);
    res.status(500).json({ error: "Error fetching hotels" });
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

router.get("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    return res.status(400).json({ error: "Hotel ID is required" });
  }
  try {
    const hotel = await Hotel.findById(id);
    return res.status(200).json(hotel);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Error getting hotel." });
  }
});

type PaymentIntentResponse = {
  paymentIntentId: string;
  clientSecret: string;
  totalCost: number;
};

router.post(
  "/:hotelId/bookings/payment-intent",
  verifyToken,
  async (req: Request, res: Response) => {
    const { userId } = req;
    const { numberOfNights } = req.body;
    const { hotelId } = req.params;
    try {
      const hotel = await Hotel.findById(hotelId);
      if (!hotel) {
        return res.status(404).json({ error: "Hotel not found." });
      }
      const totalCost = hotel.pricePerNight * numberOfNights;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalCost * 100,
        currency: "usd",
        metadata: {
          hotelId,
          userId,
        },
      });
      if (!paymentIntent.client_secret) {
        return res.status(500).json({ error: "Error creating payment intent" });
      }
      const resp: PaymentIntentResponse = {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret.toString(),
        totalCost,
      };
      return res.status(200).json(resp);
    } catch (err) {
      console.log(err);
      return res.status(500).json({ error: "Somthing went really wrong" });
    }
  }
);

router.post(
  "/:hotelId/bookings",
  verifyToken,
  async (req: Request, res: Response) => {
    const { hotelId } = req.params;
    const { paymentIntentId } = req.body;
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId as string
      );
      if (!paymentIntent) {
        return res.status(404).json({ error: "Payment intent not found" });
      }
      if (
        paymentIntent.metadata.hotelId !== hotelId ||
        paymentIntent.metadata.userId !== req.userId
      ) {
        return res.status(400).json({ error: "Payment intent mismatch" });
      }
      if (paymentIntent.status !== "succeeded") {
        return res.status(400).json({
          error: `Payment intent not succeded. Status: ${paymentIntent.status}`,
        });
      }
      const newBooking: BookingType = {
        ...req.body,
        userId: req.userId,
      };
      const hotel = await Hotel.findOneAndUpdate(
        { _id: hotelId },
        {
          $push: { bookings: newBooking },
        }
      );
      if (!hotel) {
        return res.status(404).json({ error: "Hotel not found" });
      }
      await hotel.save();
      return res.status(200).json({ success: "Success" });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ error: "Somthing went really wrong" });
    }
  }
);

export default router;
