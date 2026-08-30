const fs = require('fs');
const path = require('path');

describe('OTP security', () => {
  const authPath = path.join(__dirname, '../routes/auth.js');
  const authCode = fs.readFileSync(authPath, 'utf8');

  it('should NOT contain hardcoded OTP bypass "111111"', () => {
    expect(authCode).not.toContain("code.trim() === '111111'");
  });

  it('should NOT contain isPhoneTestCode variable', () => {
    expect(authCode).not.toContain('isPhoneTestCode');
  });

  it('should NOT contain "Test bypass" comment', () => {
    expect(authCode).not.toMatch(/test bypass/i);
  });

  it('should use verifyCode from otp.service', () => {
    expect(authCode).toContain("require('../services/otp.service')");
  });
});

describe('OTP service', () => {
  const otpService = require('../services/otp.service');

  it('should export verifyCode function', () => {
    expect(typeof otpService.verifyCode).toBe('function');
  });

  it('should export createVerificationCode function', () => {
    expect(typeof otpService.createVerificationCode).toBe('function');
  });

  it('should export isAlreadyVerified function', () => {
    expect(typeof otpService.isAlreadyVerified).toBe('function');
  });

  it('should export hashOtp function', () => {
    expect(typeof otpService.hashOtp).toBe('function');
  });

  it('hashOtp should produce consistent SHA-256 hash', () => {
    const hash1 = otpService.hashOtp('123456');
    const hash2 = otpService.hashOtp('123456');
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hashOtp should produce different hashes for different inputs', () => {
    const hash1 = otpService.hashOtp('123456');
    const hash2 = otpService.hashOtp('654321');
    expect(hash1).not.toBe(hash2);
  });
});
