import express, { Request, Response } from "express";
import User from "../models/user";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import verifyToken from "../middleware/verifyToken";

const router = express.Router();

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "All feilds are required." });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Wrong credentials" });
    }
    const comparePsw = await bcrypt.compare(password, user.password);
    if (!comparePsw) {
      return res.status(400).json({ error: "Wrong credentials" });
    }
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SEC as string, {
      expiresIn: "1d",
    });
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      maxAge: 86400000,
    });
    res.status(200).json({ userId: user._id });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Somthing went wrong" });
  }
});

router.get("/validate-token", verifyToken, (req: Request, res: Response) => {
  const { userId } = req;
  res.status(200).json({ userId });
});

router.post("/logout", (req: Request, res: Response) => {
  res.cookie("auth_token", "", {
    expires: new Date(0),
  });
  res.send();
});

export default router;
