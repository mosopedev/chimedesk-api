import 'dotenv/config'
import 'module-alias/register'
import validateEnv from './utils/validateEnv'
import App from './app'
import AgentController from '@/resources/agent/agent.controller'
import AuthController from './resources/auth/auth.controller'
import UserController from './resources/user/user.controller'
import BusinessController from './resources/business/business.controller'
import BillingController from './resources/billing/billing.controller'
import UsageController from './resources/usage/usage.controller'

const app = new App([new AgentController, new AuthController, new UserController, new AuthController, new BusinessController, new BillingController, new UsageController], Number(process.env.PORT) || 4001)

validateEnv()
app.startServer()

export default {
    socketIO: app.socketIo
}