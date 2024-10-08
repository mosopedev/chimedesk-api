import express, { Application } from "express";
import mongoose from "mongoose";
import morgan from "morgan";
import compression from "compression";
import "module-alias/register";
import helmet from "helmet";
import process from "process";
import cookieParser from "cookie-parser";
import http from "http"; 
import { Server as SocketIOServer } from "socket.io";

import ExpressMongoSanitize from 'express-mongo-sanitize'
import corsOption from "./utils/corsOption";
import IController from "./interfaces/controller.interface";
import ErrorMiddleware from "./middlewares/error.middleware";
import logger from "./utils/logger";
import { setupSocketListeners } from "./resources/chat/chat.service";

class App {
  public express: Application;
  public port: number;
  private server: http.Server;
  public io: SocketIOServer | undefined;

  constructor(controllers: IController[], port: number) {
    this.express = express();
    this.server = http.createServer(this.express);
    this.port = port;

    this.initializeMiddlewares();
    this.initializeControllers(controllers);
    this.initializeErrorHandling();
    this.initializeSocketIO();
    setupSocketListeners(this.io)
  }

  private initializeMiddlewares(): void {
    this.express.use(helmet());
    this.express.use(corsOption);
    this.express.use(morgan("dev"));
    this.express.use((req, res, next) => {
      if (req.originalUrl === "/billing/payment/webhook") {
        express.raw({ type: "application/json" })(req, res, next);
      } else {
        express.json()(req, res, next);
      }
    });
    this.express.use(express.urlencoded({ extended: false }));
    this.express.use(compression());
    this.express.use(ExpressMongoSanitize())
    this.express.use(cookieParser());
    // this.express.use('/uploads', express.static('uploads'))
  }

  private initializeControllers(controllers: IController[]): void {
    controllers.forEach((controller) => {
      this.express.use("/", controller.router);
    });
  }

    private initializeSocketIO(): void {
      this.io = new SocketIOServer(this.server, {
        cors: {
          origin: "http://localhost:3000",
          methods: ["GET", "POST", "OPTION"]
        }
      });
    }

  private initializeErrorHandling(): void {
    this.express.use(ErrorMiddleware);
  }

  public async startServer(): Promise<void> {
    const { MONGODB_URI_DEV, MONGODB_URI_CLOUD, NODE_ENV } = process.env;

    mongoose.set("strictQuery", false);
    await mongoose
      .connect(
        NODE_ENV == "production" ? `${MONGODB_URI_CLOUD}` : `${MONGODB_URI_DEV}`
      )
      .then(() => {
        logger("Database Connected");
        this.listen();
      })
      .catch((error) => {
        logger(error);
        throw new Error(error);
      });
  }

  private listen(): void {
    this.server.listen(this.port, () => {
      logger(`Server running at ${this.port}`);
    });
  }

  public async createConnection(): Promise<void> {
    // this.startServer()
  }
}

export default App;

