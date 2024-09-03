import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import IController from "interfaces/controller.interface";
import successResponse from "@/utils/success";
import HttpException from "../../exceptions/http.exception";
import * as validation from './usage.validation'
import validationMiddleware from "@/middlewares/validation.middleware";
import logger from "@/utils/logger";
import authenticatedMiddleware from "@/middlewares/authenticate.middleware";
import UsageService from "./usage.service";
import { upload } from '@/configs/multer'
import fs from 'fs';
import path from "path";
import axios from "axios";

class UsageController implements IController {
    public path = '/usage'
    public router = Router()
    private usageService = new UsageService()

    constructor() {
        this.initializeRoutes()
    }

    private initializeRoutes(): void {
    }
}

export default UsageController