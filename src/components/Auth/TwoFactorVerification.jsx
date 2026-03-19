import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { verifyTwoFactorCode, resendSMSCode } from '../../services/authService';
import LoadingSpinner from '../UI/LoadingSpinner';
import Button from '../UI/Button';
import Input from '../UI/Input';

const TwoFactorVerification = () => {
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showRecoveryCode, setShowRecoveryCode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [attemptCount, setAttemptCount] = useState(0);
  
  const navigate = useNavigate();
  const location = useLocation();
  
  const { tempToken, twoFactorMethod, phoneNumber } = location.state || {};

  useEffect(() => {
    // Redirect if no temp token (direct access attempt)
    if (!tempToken) {
      navigate('/login');
      return;
    }

    // Start cooldown timer if resend was recently used
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [tempToken, navigate, resendCooldown]);

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    
    if (!verificationCode.trim() && !recoveryCode.trim()) {
      toast.error('Please enter a verification code');
      return;
    }

    setIsLoading(true);

    try {
      const codeToVerify = showRecoveryCode ? recoveryCode : verificationCode;
      const response = await verifyTwoFactorCode({
        tempToken,
        code: codeToVerify,
        isRecoveryCode: showRecoveryCode
      });

      if (response.success) {
        // Store the final auth token
        localStorage.setItem('authToken', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        
        toast.success('Login successful!');
        
        // Redirect to intended page or dashboard
        const redirectTo = location.state?.from || '/dashboard';
        navigate(redirectTo, { replace: true });
      } else {
        setAttemptCount(prev => prev + 1);
        
        if (response.accountLocked) {
          toast.error('Account temporarily locked due to multiple failed attempts. Please try again later.');
          navigate('/login');
        } else {
          toast.error(response.message || 'Invalid verification code');
        }
      }
    } catch (error) {
      console.error('2FA verification error:', error);
      setAttemptCount(prev => prev + 1);
      
      if (error.response?.status === 429) {
        toast.error('Too many failed attempts. Account temporarily locked.');
        navigate('/login');
      } else {
        toast.error('Verification failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendSMS = async () => {
    if (twoFactorMethod !== 'sms' || resendCooldown > 0) return;

    setIsResending(true);

    try {
      const response = await resendSMSCode({ tempToken });
      
      if (response.success) {
        toast.success('Verification code sent successfully');
        setResendCooldown(60); // 60 second cooldown
      } else {
        toast.error(response.message || 'Failed to resend code');
      }
    } catch (error) {
      console.error('SMS resend error:', error);
      toast.error('Failed to resend verification code');
    } finally {
      setIsResending(false);
    }
  };

  const toggleRecoveryMode = () => {
    setShowRecoveryCode(!showRecoveryCode);
    setVerificationCode('');
    setRecoveryCode('');
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  };

  const maskPhoneNumber = (phone) => {
    if (!phone) return '';
    const formatted = formatPhoneNumber(phone);
    return formatted.replace(/\d(?=\d{4})/g, '*');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100">
            <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Two-Factor Authentication
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {showRecoveryCode ? (
              'Enter one of your backup recovery codes'
            ) : (
              <>
                Enter the verification code from your{' '}
                {twoFactorMethod === 'sms' 
                  ? `phone ${maskPhoneNumber(phoneNumber)}`
                  : 'authenticator app'
                }
              </>
            )}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleVerifyCode}>
          <div>
            {showRecoveryCode ? (
              <Input
                label="Recovery Code"
                type="text"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value.replace(/\s/g, ''))}
                placeholder="Enter 8-character recovery code"
                maxLength={8}
                className="text-center font-mono text-lg tracking-widest"
                autoComplete="off"
                required
              />
            ) : (
              <Input
                label="Verification Code"
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                placeholder={twoFactorMethod === 'sms' ? '123456' : '123456'}
                maxLength={6}
                className="text-center font-mono text-lg tracking-widest"
                autoComplete="one-time-code"
                required
              />
            )}
          </div>

          {attemptCount > 0 && attemptCount < 5 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-sm text-yellow-800">
                {5 - attemptCount} attempt{5 - attemptCount !== 1 ? 's' : ''} remaining before account lockout
              </p>
            </div>
          )}

          <div>
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? <LoadingSpinner size="sm" /> : 'Verify'}
            </Button>
          </div>

          <div className="space-y-2">
            {/* SMS Resend Option */}
            {twoFactorMethod === 'sms' && !showRecoveryCode && (
              <button
                type="button"
                onClick={handleResendSMS}
                disabled={resendCooldown > 0 || isResending}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-500 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {isResending ? (
                  <span className="flex items-center justify-center">
                    <LoadingSpinner size="xs" />
                    <span className="ml-2">Sending...</span>
                  </span>
                ) : resendCooldown > 0 ? (
                  `Resend code in ${resendCooldown}s`
                ) : (
                  'Resend verification code'
                )}
              </button>
            )}

            {/* Recovery Code Toggle */}
            <button
              type="button"
              onClick={toggleRecoveryMode}
              className="w-full text-center text-sm text-blue-600 hover:text-blue-500"
            >
              {showRecoveryCode ? 
                'Use verification code instead' : 
                'Use backup recovery code'
              }
            </button>

            {/* Back to Login */}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full text-center text-sm text-gray-600 hover:text-gray-500"
            >
              Back to login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TwoFactorVerification;