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

  it('should export generateOtp function', () => {
    expect(typeof otpService.generateOtp).toBe('function');
  });

  it('generateOtp should return 6-digit string', () => {
    const otp = otpService.generateOtp();
    expect(otp).toMatch(/^\d{6}$/);
  });
});
