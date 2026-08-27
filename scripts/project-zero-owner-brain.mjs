const MAX_OWNER_BRAIN_BYTES = 16 * 1024;

export function validateOwnerBrain(content) {
  if (typeof content !== 'string') {
    throw new TypeError('WILLIAM-BRAIN input must be UTF-8 text.');
  }

  const bytes = Buffer.byteLength(content, 'utf8');
  if (bytes === 0) {
    throw new Error('WILLIAM-BRAIN input is empty.');
  }
  if (bytes > MAX_OWNER_BRAIN_BYTES) {
    throw new Error(
      `WILLIAM-BRAIN exceeds the ${MAX_OWNER_BRAIN_BYTES}-byte startup budget (${bytes} bytes).`,
    );
  }

  return content.replaceAll('\r\n', '\n').trimEnd();
}

export { MAX_OWNER_BRAIN_BYTES };
