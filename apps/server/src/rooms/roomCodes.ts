// Avoid ambiguous characters (O/0, I/1) so codes are easy to read and say aloud.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 4;

function randomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/** Generates a room code guaranteed not to collide with any code in `existing`. */
export function generateUniqueRoomCode(existing: ReadonlySet<string>): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    const code = randomCode();
    if (!existing.has(code)) return code;
  }
  throw new Error("Could not generate a unique room code after 100 attempts");
}
