import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies["auth_token"];
  if (!token) {
    return res.status(401).json({ error: "unauthorized" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SEC as string);
    req.userId = (decoded as JwtPayload).userId;
    next();
  } catch (error) {
    console.log(error);
    return res.status(401).json({ error: "unauthorized" });
  }
};

export default verifyToken;
