export const OFFICE_POSTAL_ADDRESS = {
  streetAddress: "Level 1, 17A Solomon St",
  addressLocality: "Adelaide",
  addressRegion: "SA",
  postalCode: "5000",
  addressCountry: "AU",
} as const;

const { streetAddress, addressLocality, addressRegion, postalCode } =
  OFFICE_POSTAL_ADDRESS;
export const OFFICE_ADDRESS = `${streetAddress}, ${addressLocality} ${addressRegion} ${postalCode}`;
