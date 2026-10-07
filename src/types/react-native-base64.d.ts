/**
 * Minimal type declarations for react-native-base64 (ships without types).
 */
declare module 'react-native-base64' {
  const base64: {
    encode(input: string): string;
    encodeFromByteArray(input: number[]): string;
    decode(input: string): string;
  };
  export default base64;
}
