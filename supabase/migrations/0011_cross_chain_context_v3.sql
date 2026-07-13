DELETE FROM cross_chain_context
WHERE data->>'schemaVersion' IS DISTINCT FROM 'kx.cross-chain-context.v3';
