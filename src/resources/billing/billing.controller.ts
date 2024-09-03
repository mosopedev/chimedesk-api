import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import IController from "interfaces/controller.interface";
import successResponse from "@/utils/success";
import HttpException from "../../exceptions/http.exception";
import * as validation from './billing.validation'
import validationMiddleware from "@/middlewares/validation.middleware";
import logger from "@/utils/logger";
import authenticatedMiddleware from "@/middlewares/authenticate.middleware";
import BillingService from "./billing.service";
import { upload } from '@/configs/multer'
import fs from 'fs';
import path from "path";
import axios from "axios";

class BillingController implements IController {
    public path = '/billing'
    public router = Router()
    private billingService = new BillingService()

    constructor() {
        this.initializeRoutes()
    }

    private initializeRoutes(): void {
        this.router.post(`${this.path}/phones/monthly-fee`, this.debitMonthlyPhoneBill)
        this.router.get(`${this.path}/business/:businessId/balance`, authenticatedMiddleware, this.getBusinessBalance)
    }

    private debitMonthlyPhoneBill = async (req: Request | any, res: Response, next: NextFunction): Promise<void> => {
        try {
            if(new Date().getDate() !== 1) throw new Error("Action denied.")

            await this.billingService.debitMonthlyPhoneBill()

            successResponse(200, "Job completed successfully", res)
        } catch (error: any) {
            next(new HttpException(400, error.message))
        }
    }

    private getBusinessBalance = async (req: Request | any, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { businessId } = req.params;

            if(!businessId) throw new Error("Invalid request: Provide business ID")

            const response = await this.billingService.getBusinessBalance(businessId)

            successResponse(200, "Balance retrieved successfully", res, response)
        } catch (error: any) {
            next(new HttpException(400, error.message))
        }
    }
}

export default BillingController