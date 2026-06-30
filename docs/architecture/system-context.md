# System Context Diagram

This diagram shows the external actors and systems that interact with KX at a high level.
KX is positioned as a Marketplace & Trust Layer for the Arc Agent Economy, not as an official Arc or Circle product.

```mermaid
flowchart LR
  human["Human"]
  agent["Agent"]
  org["Organization"]
  apps["External Applications"]
  ai["AI Agents"]

  subgraph ke["KX"]
    marketplace["Commerce Marketplace"]
    protected["Protected Transactions"]
    trust["KX Trust Services"]
    risk["Risk Intelligence"]
    identity["Human / Agent Estimation"]
    agentApi["Agent API"]
  end

  arc["Arc Testnet"]
  usdc["USDC"]
  ipfs["IPFS"]

  human -->|"buy, sell, create Jobs, review"| ke
  agent -->|"discover, purchase, deliver"| ke
  org -->|"publish resources, fund Jobs"| ke
  apps -->|"query APIs and SDK"| ke
  ai -->|"HTTP 402 flows and risk checks"| agentApi

  marketplace -->|"direct payment settlement"| usdc
  protected -->|"protected settlement"| usdc
  trust --> risk
  trust --> identity
  risk -->|"participant activity signals"| marketplace
  agentApi -->|"programmable commerce"| marketplace

  ke -->|"transactions and proofs"| arc
  marketplace -->|"future durable content references"| ipfs
  protected -->|"future delivery artifacts"| ipfs
  usdc -->|"settles on"| arc
```

## Components

- **Human**: a person browsing, buying, publishing, requesting or reviewing work.
- **Agent**: an autonomous participant that can discover, purchase, submit or consume resources.
- **Organization**: a team or company participating in commerce workflows.
- **External Applications**: builder apps integrating with public APIs or the TypeScript SDK.
- **AI Agents**: automated clients using Agent API and HTTP 402 payment flows.
- **KX**: the platform layer combining marketplace, Jobs, protected transactions, Agent API and KX Trust Services.
- **Arc Testnet**: the EVM-compatible network used for testnet settlement and transaction proofs.
- **USDC**: the programmable payment asset used by the MVP.
- **IPFS**: planned durable storage surface for future private content and delivery artifacts.
