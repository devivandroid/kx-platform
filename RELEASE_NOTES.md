# KX Trust Engine RC1 Release Notes

## Summary

RC1 freezes the current feature set and polishes KX into a Trust Engine release candidate for Arc
Testnet. The release focuses on Arc-native positioning, signed trust artifacts, explainable policy
decisions, SDK consistency and documentation quality.

## Highlights

- **Arc Native integration**: KX positions Arc as the source of truth for Identity, Jobs,
  Reputation, Validation and Settlement when configured.
- **KX Trust Engine**: Risk Intelligence is now presented as one module inside the broader KX Trust
  Engine experience.
- **Signed Trust Snapshots**: wallet analysis automatically creates signed off-chain snapshots when
  backend signing is configured.
- **Trust Policy Engine**: built-in policies return explainable `ALLOW`, `REVIEW` or `BLOCK`
  decisions.
- **Trust Attestations**: selected snapshots can be manually published as experimental TEST
  attestations on Arc Testnet.
- **SDK improvements**: SDK exports include `verifyTrustSnapshot()`, `verifyReportHash()`,
  `recoverTrustSnapshotSigner()` and `evaluateTrustPolicy()`.
- **UX improvements**: Trust Engine UI is decision-first, with technical details collapsed by
  default.
- **API improvements**: primary Trust Engine APIs are documented and preserved without breaking
  existing routes.

## Current Release Behavior

- Signed Trust Snapshot generation: automatic during wallet analysis.
- Trust Attestation publishing: manual TEST mode only.
- Automatic Trust Attestation publishing: intentionally disabled.
- Skipped snapshots include a publication eligibility reason.

## Primary APIs

```txt
GET  /api/risk/profile/:wallet
GET  /api/risk/snapshots/:wallet
POST /api/trust/policy/evaluate
POST /api/risk/snapshots/:wallet
GET  /api/agent-capabilities
```

## Architecture

```txt
Arc
  -> KX Trust Engine
  -> Signed Trust Snapshot
  -> Trust Policy Engine
  -> Trust Attestation
  -> Arc Testnet
```

Signed Trust Snapshots are the primary trust artifact. Trust Attestations certify selected
snapshots on Arc Testnet.

## Limitations

- RC1 is Arc Testnet software.
- It is not KYC, AML, compliance screening or identity verification.
- Trust Attestation publishing is experimental and should remain manual until production policy is
  finalized.
- SDK remains repository-local and is not published to npm.
