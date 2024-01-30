import express, { Request, Response } from "express";
import multer from "multer";
import cloudinary from "cloudinary";
import Hotel, { HotelType } from "../models/hotel";
import verifyToken from "../middleware/verifyToken";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

router.post(
  "/",
  verifyToken,
  upload.array("imageFiles", 6),
  async (req: Request, res: Response) => {
    const imageFiles = req.files as Express.Multer.File[];
    const newHotel: HotelType = req.body;
    const userId = req.userId;
    if (!newHotel.name || newHotel.name.trim().length === 0) {
      return res.status(404).json({ error: "Name of the hotel is required" });
    }
    if (!newHotel.city || newHotel.city.trim().length === 0) {
      return res.status(404).json({ error: "City feild is required" });
    }
    if (!newHotel.country || newHotel.country.trim().length === 0) {
      return res.status(404).json({ error: "Country feild is required" });
    }
    if (!newHotel.description || newHotel.description.trim().length === 0) {
      return res.status(404).json({ error: "Description is required" });
    }
    if (newHotel.type.trim().length === 0 || !newHotel.type) {
      return res.status(404).json({ error: "Hotel type is required" });
    }
    if (!newHotel.pricePerNight || isNaN(newHotel.pricePerNight)) {
      return res.status(404).json({ error: "Price is required" });
    }
    if (
      !newHotel.facilities ||
      !Array.isArray(newHotel.facilities) ||
      !newHotel.facilities.length
    ) {
      return res.status(404).json({ error: "Facilities feild is required" });
    }
    try {
      const imageUrls = await uploadImages(imageFiles);
      newHotel.imageUrls = imageUrls;
      newHotel.lastUpdated = new Date();
      newHotel.userId = userId;
      const hotel = new Hotel(newHotel);
      await hotel.save();
      return res.status(200).json(hotel);
    } catch (err) {
      console.log(err);
      res.status(500).json({ error: "Somthing went wrong" });
    }
  }
);

router.get("/", verifyToken, async (req: Request, res: Response) => {
  const { userId } = req;
  try {
    const hotels = await Hotel.find({ userId });
    if (!hotels) {
      return res
        .status(404)
        .json({ error: "You didnt create any hotels yet." });
    }
    return res.status(200).json(hotels);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Error getting hotels." });
  }
});

router.get("/:id", verifyToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { userId } = req;
  try {
    const hotel = await Hotel.findOne({ _id: id, userId });
    return res.status(200).json(hotel);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Error getting hotel." });
  }
});

router.put(
  "/:hotelId",
  verifyToken,
  upload.array("imageFiles", 6),
  async (req: Request, res: Response) => {
    const { userId } = req;
    const { hotelId } = req.params;
    const updatedHotel: HotelType = req.body;
    updatedHotel.lastUpdated = new Date();
    try {
      const hotel = await Hotel.findOneAndUpdate(
        { _id: hotelId, userId },
        updatedHotel,
        { new: true }
      );
      if (!hotel) {
        return res.status(404).json({ error: "Hotel not found." });
      }
      const files = req.files as Express.Multer.File[];
      const updatedImageUrls = await uploadImages(files);
      hotel.imageUrls = [
        ...updatedImageUrls,
        ...(updatedHotel.imageUrls || []),
      ];
      await hotel.save();

      return res.status(201).json(hotel);
    } catch (err) {
      console.log(err);
      return res.status(500).json({ error: "Failed to update your hotel." });
    }
  }
);

async function uploadImages(imageFiles: Express.Multer.File[]) {
  const uploadPromises = imageFiles.map(async (image) => {
    const b64 = Buffer.from(image.buffer).toString("base64");
    const dataURI = "data:" + image.mimetype + ";base64," + b64;
    const resp = await cloudinary.v2.uploader.upload(dataURI);
    return resp.url;
  });
  const imageUrls = await Promise.all(uploadPromises);
  return imageUrls;
}

export default router;
