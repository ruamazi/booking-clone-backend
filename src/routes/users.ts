import express, { Request, Response } from "express";
import User from "../models/user";
import jwt from "jsonwebtoken";
import verifyToken from "../middleware/verifyToken";

const router = express.Router();

router.get("/me", verifyToken, async (req: Request, res: Response) => {
  const { userId } = req;
  try {
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.status(200).json(user);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Somthing went wrong" });
  }
});

router.post("/register", async (req: Request, res: Response) => {
  const { email, password, firstName, lastName } = req.body;
  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ error: "All feilds are required." });
  }
  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: "User already exists" });
    }
    const user = new User({
      email,
      password,
      firstName,
      lastName,
    });
    await user.save();
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SEC as string, {
      expiresIn: "1d",
    });
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      maxAge: 86400000,
    });
    return res.status(200).json({ success: "User created successfully" });
  } catch (err) {
    console.log(err);
    return res.status(500).send({ error: "Somthing went wrong." });
  }
});

export default router;
