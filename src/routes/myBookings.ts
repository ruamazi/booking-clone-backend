import express, { Request, Response } from "express";
import verifyToken from "../middleware/verifyToken";
import Hotel, { HotelType } from "../models/hotel";

const router = express.Router();

router.get("/", verifyToken, async (req: Request, res: Response) => {
  const { userId } = req;
  try {
    const hotels = await Hotel.find({
      bookings: { $elemMatch: { userId } },
    });
    const results = hotels.map((hotel) => {
      const userBookings = hotel.bookings.filter(
        (booking) => booking.userId === userId
      );
      const hotelWithUserBookings: HotelType = {
        ...hotel.toObject(),
        bookings: userBookings,
      };
      return hotelWithUserBookings;
    });

    res.status(200).json(results);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Unable to fetch bookings" });
  }
});

export default router;
