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
  const { page } = req.query;
  const pageSize = 5;
  const pageNumber = parseInt(page ? page.toString() : "1");
  const skipSize = (pageNumber - 1) * pageSize;
  try {
    const hotels = await Hotel.find().skip(skipSize).limit(pageSize);
    const total = await Hotel.countDocuments();
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

export default router;
