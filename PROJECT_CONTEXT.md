# Project Context

## KX Trust Engine

**Arc-native trust infrastructure for human and agent commerce.**

**Understand trust before transacting.**

KX, formerly Knowledge Exchange, is now positioned as KX Trust Engine.

KX Trust Engine is Arc-native trust infrastructure for human and agent commerce. It helps
participants and builders evaluate trust before transacting, assigning Jobs, publishing resources
or integrating autonomous agent workflows.

Builders can use KX to query Risk Intelligence, Human / Agent Estimation, Signed Trust Snapshots,
Trust Policy decisions, experimental Trust Attestations and KX SDK integrations.

## Platform Positioning

KX Trust Engine is:

- a **Human & Agent Commerce Platform** for humans, autonomous agents and organizations
- a **programmable trust layer** for Arc-native commerce workflows
- a **Marketplace & Trust Layer for the Arc Agent Economy**
- a **reusable platform for builders** integrating commerce, risk and agent-facing APIs

## Architecture Flow

```txt
Arc
  -> KX Trust Engine
  -> Signed Trust Snapshot
  -> Trust Policy Engine
  -> Trust Attestation
  -> Arc Testnet
```

Signed Trust Snapshots are the primary trust artifact and source of truth inside KX. Trust
Attestations certify selected snapshots on Arc Testnet. RC1 keeps Trust Attestation publishing
manual in TEST mode only.

## Reference Application

The Marketplace is the reference application for the platform. It demonstrates how participants can
publish resources, buy knowledge products, create Jobs and interact with programmable USDC
payment flows.

The broader platform also includes:

- **Risk Intelligence** for participant-aware risk profiles, behavioral signals and confidence
  levels
- **Human / Agent Estimation** for explainable Arc Network behavioral estimation
- **Signed Trust Snapshots** for cryptographically signed off-chain trust reports
- **Trust Policy Engine** for ALLOW, REVIEW or BLOCK decisions under selected policies
- **Trust Attestations** for selected snapshot certification on Arc Testnet in manual TEST mode
- **Protected Transactions** for custom work and review-before-release workflows
- **KX Trust Services** for reusable Risk Intelligence and Human / Agent Estimation over Jobs
- **TypeScript SDK** for builder integrations and autonomous agent workflows
- **Agent API** for HTTP 402 programmable commerce flows

## Arc Native Integration

KX treats Arc as the source of truth for native Identity, Jobs, Settlement, Reputation and
Validation when official registries are configured. KX consumes Arc registry data through
configurable registry addresses and falls back to self-declared identity, the existing protected
settlement flow and KX Commercial Rating when no official record is available. KX extends Arc with
marketplace surfaces, trust services, public APIs and SDKs; it does not replace Arc functionality.

KX Platform is an independent project built on Arc Testnet. It is not affiliated with,
endorsed by, or officially supported by Circle or Arc.
