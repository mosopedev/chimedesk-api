export default interface IChat {
    agentId: string;
    messages: Array<{
        sender: string;
        message: string;
        timestamp: Date;
    }>;
    sessionId: string;
}