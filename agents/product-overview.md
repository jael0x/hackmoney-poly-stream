# Betting Platform and Prediction Markets for Live Streamers (Yellow Integration)

## 📌 Problem

Real-time betting and prediction markets within streaming platforms (Twitch, Kick) face two main challenges when trying to use Web3 technology:

1.  **High Costs and Latency:** Prediction systems that use the main blockchain (*on-chain*) are inherently slow and generate high transaction costs (*gas fees*). This makes them unviable for live events, where action is instantaneous and requires immediate response and settlement.
2.  **Lack of Web3 Experience:** Our team identifies primarily as *backend* and *frontend* developers with limited experience in Web3 development, which requires a protocol that simplifies the implementation of decentralized transactions.

## ✨ Proposed Solution (MVP - Version Zero)

We will develop a **standalone web application**, Poly Market style, that will function as a live prediction market for *streamers*. The key to solving the latency and cost problem is integration with the **Yellow** protocol.

### 🎯 Yellow's Role in the Solution

**Yellow** is an *off-chain* network designed for games and applications that demand instant user actions.

*   **Fast and Gasless Transactions:** Yellow allows transactions and bets to be made **off the main chain**, eliminating *gas fees* and ensuring that user actions (such as placing a bet) are instantaneous.
*   **Viable Prediction Markets:** This makes the "Polymarket for a streamer" model feasible, as bets and settlement can occur at the speed of a live event.

### 🛠️ Technology Stack

| Component | Technology | Role / Justification |
| :---: | :---: | :--- |
| **Frontend/Backend** | Next.js | Unified development stack known by the team for rapid implementation. |
| **Database** | Supabase (Postgres) | Using the API *wrapper* for a ready-to-use and easy-to-integrate *backend*. |
| **User Interface** | Bolt | Tool to accelerate *frontend* *scaffolding* and quickly generate a functional design (similar to Polymarket). |
| **Main Protocol** | **Yellow** | The pillar of the solution: Enables fast and gasless *off-chain* transactions for live prediction markets. |
| **Data Source** | Twitch/Kick API | Will be used to obtain information about live *streams* (e.g., simple metrics, list of *streams*). |
