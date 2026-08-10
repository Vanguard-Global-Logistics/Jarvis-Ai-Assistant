import { describe, expect, it } from 'vitest';
import { REQUIRED_NODE_MAJOR, parseNodeMajor, validateDoctorLocalUrl } from './doctor.mjs';

describe('doctor helpers', () => {
  it('parses the supported Node major version', () => {
    expect(parseNodeMajor('22.18.0')).toBe(REQUIRED_NODE_MAJOR);
    expect(parseNodeMajor('invalid')).toBe(0);
  });

  it('accepts only credential-free loopback HTTP URLs', () => {
    expect(validateDoctorLocalUrl('http://127.0.0.1:8000/')).toBe('http://127.0.0.1:8000');
    expect(validateDoctorLocalUrl('http://localhost:8000')).toBe('http://localhost:8000');
  });

  it.each([
    'https://127.0.0.1:8000',
    'http://192.168.1.10:8000',
    'http://user:pass@localhost:8000',
    'http://localhost:8000?secret=value',
  ])('rejects unsafe local inference URL %s', (url) => {
    expect(() => validateDoctorLocalUrl(url)).toThrow(/loopback/);
  });
});
