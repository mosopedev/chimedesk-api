# Chimedesk AI

**Chimedesk** is an AI platform designed to supercharge customer support with intelligent call handling and chatbot services.

## Instant Support, Infinite Possibilities

With **Chimedesk**, your AI agents can handle customer queries, complaints, and much more. From cancelling orders, booking appointments, and escalating to a human agent, to creating support tickets, Chimedesk goes beyond just responding—it takes action.

---

### Project Links
- **Visit Chimedesk:** ehemmehmm. ⚠️ currently under construction.
- **Integrate Chimedesk Chatbot on Your Website:** [Link to npm package](#)
- **Backend API Documentation:** [View API Documentation on Postman](https://documenter.getpostman.com/view/23648952/2sAXqzYeew)

---

## Technologies Used
- **Twilio** – Voice and SMS integrations
- **OpenAI Assistant** – AI-driven customer support
- **Stripe Payment** – Payment processing and billing
- **Socket.io** – Real-time communication
- **Node.js** – Backend server
- **TypeScript** – Typed JavaScript for scalability
- **MongoDB** – Database for storing user and agent data

---

## Features
- Create business profiles
- Purchase phone numbers for business support
- Build and manage call and chat agents
- Configure call agents with custom webhooks for action-based responses

---

## What I Learned
- **GPT-4 model fine-tuning** – Enhancing the model’s performance for specific use cases
- **Twilio speech-to-text transcription** – Converting voice calls into actionable text data
- **OpenAI Assistant** – Leveraging AI to understand and resolve customer issues
- **Payment collection and billing** – Using Stripe for usage-based billing models

---

## Current Limitations
- **Latency in Call Agents:** The current call agents experience up to 4 seconds of delay. This is due to:
  1. Converting speech to text using Twilio
  2. Processing the text through an AI model to generate a response
  3. Converting the AI's response from text back to speech
  4. Executing actions like API requests to custom webhooks

### Planned Improvements
- **Reduce Latency:** Optimize the speech-to-text and response generation process by:
  - Preprocessing common queries for faster responses
  - Reducing the number of requests sent between services
  - Optimizing webhook performance
  - Introducing caching for frequent API calls

---

## Getting Started
To integrate **Chimedesk** into your application:
1. Install the chatbot package via npm:
   ```bash
   npm install chimedesk-chat-widget
