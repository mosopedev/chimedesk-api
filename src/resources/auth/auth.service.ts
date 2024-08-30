import translateError from "@/utils/mongod.helper";
import userModel from '../user/user.model';
import IUser from '../user/user.interface';
import * as token from '@/utils/token'
import logger from '@/utils/logger';
import authModel from "./auth.model";
import IAuth from "./auth.interface";
import sendMail from "@/utils/zepto";
import bcrypt from 'bcrypt'
import generateOtp from "@/utils/otp";
import moment from "moment";


class AuthService {
  public async signup(firstname: string, password: string, email: string, lastname: string): Promise<{
    accessToken: string, refreshToken: string
  }> {
    try {
      if (!(await this.validatePasswordPolicy(password))) throw new Error('Password is not secure. Include at least one uppercase, lowercase, special character and number.')

      const otp = generateOtp(5)

      const user = await userModel.create({
        firstname,
        lastname,
        email: email.toLowerCase(),
        password,
        emailVerificationToken: {
          token: otp,
          expires: moment(new Date()).add(5, "m").toDate()
        }
      })

      if (!user) throw new Error('Unable to create your account. Please try again.')

      const accessToken = await token.generateToken(user.id, true)
      const refreshToken = await token.generateToken(user.id, false)

      // log session
      const authSession: IAuth = await authModel.create({
        userId: user.id,
        refreshToken: refreshToken,
      })

      logger(accessToken, refreshToken, authSession)


      await sendMail(
        "chimecall-wel-mail",
        {
          email,
          name: `${firstname} ${lastname}`
        }, "Welcome to Chime Call ☎️",
        {
          "name": `${firstname} ${lastname}`,
          "product_name": 'Chime Call',
          "verification_code": otp
        })

      return {
        accessToken,
        refreshToken
      };
    } catch (error) {
      logger(error)
      throw new Error(translateError(error)[0] || 'Unable to create your account. Please try again.')
    }
  }

  public async login(email: string, password: string): Promise<{
    accessToken: string, refreshToken: string, user: { firstname: string, lastname: string, email: string, photo?: string, isEmailVerified: boolean }
  }> {
    try {
      const user: IUser | null = await userModel.findOne({ email: email.toLowerCase() })

      if (!user) throw new Error('Incorrect email or password')

      const { firstname, lastname, isEmailVerified } = user

      if (!user.isEmailVerified) throw new Error("Please verify your email.")

      if (!(await user.isValidPassword(password))) throw new Error('Incorrect email or password')

      // End user's existing session, if any
      await authModel.deleteOne({ userId: user.id })

      const accessToken = await token.generateToken(user.id, true)
      const refreshToken = await token.generateToken(user.id, false)

      // Log new user session
      const authSession: IAuth = await authModel.create({
        userId: user.id,
        refreshToken: refreshToken,
      })
      logger(authSession)

      return {
        accessToken,
        refreshToken,
        user: {
          firstname,
          lastname,
          email,
          isEmailVerified
        }
      }

    } catch (error: any) {
      logger(error)
      throw new Error(translateError(error)[0] || 'Incorrect email or password.')
    }

  }

  private async validatePasswordPolicy(password: string): Promise<Boolean> {
    try {
      /**
       * Method to validate user password against password policy.
       *
       * Password Policy: Password must be minimum length of 8 and maximum of 64,
       * password should contain atleast one valid special character, uppercase letter, lowercase letter and digit.
       */
      const REQUIRED_CHARACTER_CLASSES = 4;

      const characterClasses: Record<string, RegExp> = {
        uppercase: /[A-Z]/,
        lowercase: /[a-z]/,
        digit: /\d/,
        special: /[^\w\s]/,
      };

      let count = 0;

      for (const [name, regex] of Object.entries(characterClasses)) {
        if (regex.test(password)) {
          count += 1;
        }
      }

      if (count < REQUIRED_CHARACTER_CLASSES) {
        return false;
      }

      return true;
    } catch (error) {
      throw new Error(
        translateError(error)[0] || "Unable to validate password security"
      );
    }
  }

  public async verifyEmail(formToken: string, id: string): Promise<void> {
    try {
      const user: IUser | null = await userModel.findById(id)

      if (!user) throw new Error('Unable to verify email. Account not found')

      const { token, expires } = user.emailVerificationToken

      if (Date.now() > new Date(expires).getTime() || token != formToken) throw new Error("Invalid or expired token.")

      const updatedUser = await userModel.findByIdAndUpdate(id, {
        isEmailVerified: true
      })

      if (!updatedUser) throw new Error("Unable to verify email. Please try again.")
    } catch (error: any) {
      throw new Error(
        error || "Unable to verify email. Please try again."
      );
    }
  }

  public async forgotPassword(email: string): Promise<void> {
    try {
      const otp = generateOtp(5)

      const user: IUser | null = await userModel.findOneAndUpdate({ email }, {
        resetPasswordToken: {
          token: otp,
          expires: moment(new Date).add(5, 'm').toDate()
        }
      })

    if (!user) throw new Error('Unable to send reset password mail. Account not found.')

    const { firstname, lastname } = user;

    await sendMail(
      "chime-reset-password",
      {
        email,
        name: `${firstname} ${lastname}`
      }, "Reset your password",
      {
        "name": `${firstname} ${lastname}`,
        "product_name": 'Chime Call',
        "verification_code": otp
      })
    } catch (error: any) {
      throw new Error(error || 'Unable to send forgot password email. Please try again')
    } 
  }

  public async resetPassword(email: string, formToken: string, password: string) {
    try {
      const user = await userModel.findOne({email})

      if(!user) throw new Error("Unable to reset password. Account not found.")

      const { token, expires } = user.resetPasswordToken

      if (Date.now() > new Date(expires).getTime() || token != formToken) throw new Error("Invalid or expired token.")

      await userModel.findOneAndUpdate({
        email
      }, { password: await bcrypt.hash(password, 10)})

    } catch (error: any) {
      throw new Error(error || 'Unable to reset password. Please try again')
    }
  }
}

export default AuthService