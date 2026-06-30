# Sequence Diagram

This diagram shows a complete protected transaction path with Risk Guard. It includes the no-data
wallet behavior: missing KX activity is not treated as high risk by default.

```mermaid
sequenceDiagram
  autonumber
  actor Buyer
  participant Marketplace
  participant RiskGuard as Risk Guard
  participant Trust as KX Trust Services
  participant Engine as Risk Intelligence Engine
  participant RiskApis as Public Risk Intelligence APIs
  participant Protected as Protected Transaction
  participant USDC
  participant Seller

  Buyer->>Marketplace: Select resource or Job
  Marketplace->>RiskGuard: Evaluate seller/provider wallet with policy
  RiskGuard->>Trust: Request trust assessment
  Trust->>Engine: Load participant profile
  Engine->>RiskApis: Resolve profile, summary and signals
  RiskApis-->>Engine: RiskProfile or no_data profile
  Engine-->>RiskGuard: Scores, tier, confidence, profileStatus

  alt Decision is allow
    RiskGuard-->>Marketplace: allow
    Marketplace->>Protected: Create or continue protected settlement
    Protected->>USDC: Transfer or settle USDC
    USDC-->>Seller: Payment settlement
    Protected-->>Buyer: Receipt and transaction proof
  else Decision is review
    RiskGuard-->>Marketplace: review
    Marketplace-->>Buyer: Request human confirmation or extra verification
    Buyer->>Protected: Continue only after review
  else Decision is block
    RiskGuard-->>Marketplace: block
    Marketplace-->>Buyer: Stop transaction flow
  else Wallet has no KX activity
    Engine-->>RiskGuard: profileStatus no_data, riskTier Unknown, null scores
    RiskGuard-->>Marketplace: review by default
    Marketplace-->>Buyer: Missing data is not high risk; request additional verification
  end
```

## Components

- **Buyer**: human, agent or organization initiating commerce.
- **Marketplace**: product surface that starts resource purchase or Job workflows.
- **Risk Guard**: evaluates a client-defined risk policy before a transaction proceeds.
- **KX Trust Services**: reusable services over Arc-compatible Jobs, currently Risk Intelligence and Human / Agent Estimation.
- **Risk Intelligence Engine**: computes participant profile status, risk tier, confidence and signals.
- **Public Risk Intelligence APIs**: REST layer exposing profile, summary, signals, model and participants endpoints.
- **Protected Transaction**: protected settlement flow for custom work and review-before-release scenarios.
- **USDC**: settlement asset for direct transfers and protected transactions.
- **Seller**: resource seller or service provider receiving payment after successful flow.
