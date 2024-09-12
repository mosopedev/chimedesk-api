import bcrypt from 'bcrypt';
import { Request, Response, NextFunction } from 'express';
import AgentService from '@/resources/agent/agent.service';
import HttpException from '../exceptions/http.exception';

export const verifyAgentApiKey = async (req: Request | any, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return next(new HttpException(401, 'Please provide your agent\'s secret key. You can locate the secret key in the Settings section of your ChimeDesk Chat Agent dashboard.'))
  }

  try {
    const agent = await new AgentService().verifyAgentApiKey(apiKey, req.body.agent);

    if (!(await bcrypt.compare(apiKey, agent.agentApiKey))) {
        return next(new HttpException(403, 'Invalid api secret.')) 
    }

    req.agent = agent._id
    return next()

  } catch (error: any) {
    return next(new HttpException(401, error.message || 'Your session has expired. Login to continue'))
  }
};
