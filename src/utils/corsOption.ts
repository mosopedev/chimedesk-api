// options for cors
import { Request, Response, NextFunction } from "express";

export const corsOption =  (req: Request, res: Response, next: NextFunction) => {

  const allowedOrigins = ["http://localhost:4000"];

  const origin: any = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "content-type, Authorization, application/json");
  next();
};

export default corsOption