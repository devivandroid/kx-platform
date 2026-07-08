const blockedPlaceholderWallets = new Set(
  [
    "0xdddddddddddddddddddddddddddddddddddddddd",
    "0xcccccccccccccccccccccccccccccccccccccccc",
    "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "0x9999999999999999999999999999999999999999",
    "0x8888888888888888888888888888888888888888",
    "0x7777777777777777777777777777777777777777",
    "0x6666666666666666666666666666666666666666",
    "0x5555555555555555555555555555555555555555",
    "0x4444444444444444444444444444444444444444",
    "0x3333333333333333333333333333333333333333",
    "0x2222222222222222222222222222222222222222",
    "0x1111111111111111111111111111111111111111"
  ].map((wallet) => wallet.toLowerCase())
);

export function isBlockedPlaceholderWallet(wallet?: string | null): boolean {
  return Boolean(wallet && blockedPlaceholderWallets.has(wallet.toLowerCase()));
}
