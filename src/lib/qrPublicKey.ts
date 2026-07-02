// ES256 (ECDSA P-256) public key — used to verify signed QR codes offline
// The matching private key is stored in Supabase secrets (PARAPASS_SIGNING_PRIVATE_KEY_JWK)
export const QR_PUBLIC_KEY_JWK = {
  key_ops: ['verify'],
  ext: true,
  kty: 'EC',
  x: 'BgosRKSDFSZG0w1VHHCDFNQNkizNu25UEnxyyTfxUN8',
  y: '2w2UoEur2W9BcbR2bFuqIcEWJ-HeNdaWOqaB7BydYPA',
  crv: 'P-256',
} as const;
