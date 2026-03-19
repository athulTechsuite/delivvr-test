import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'react-toastify';
import { 
  Shield, 
  Smartphone, 
  Key, 
  Copy, 
  RefreshCw, 
  AlertTriangle,
  Check,
  X
} from 'lucide-react';

const TwoFactorAuth = ({ user, onUpdate }) => {
  const [isEnabled, setIsEnabled] = useState(user?.twoFactorEnabled || false);
  const [setupMethod, setSetupMethod] = useState(null); // 'totp' or 'sms'
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [step, setStep] = useState('overview'); // overview, setup, verify, complete

  useEffect(() => {
    if (user?.twoFactorEnabled) {
      setIsEnabled(true);
      fetchBackupCodes();
    }
  }, [user]);

  const fetchBackupCodes = async () => {
    try {
      const response = await fetch('/api/auth/2fa/backup-codes', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setBackupCodes(data.codes);
      }
    } catch (error) {
      console.error('Failed to fetch backup codes:', error);
    }
  };

  const initiateTOTPSetup = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/2fa/setup-totp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      if (response.ok) {
        setQrCode(data.qrCode);
        setSecret(data.secret);
        setSetupMethod('totp');
        setStep('setup');
      } else {
        toast.error(data.message || 'Failed to setup authenticator');
      }
    } catch (error) {
      toast.error('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const initiateSMSSetup = () => {
    setSetupMethod('sms');
    setStep('setup');
  };

  const sendSMSCode = async () => {
    if (!phoneNumber) {
      toast.error('Please enter a valid phone number');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/2fa/setup-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ phoneNumber })
      });

      const data = await response.json();
      if (response.ok) {
        toast.success('Verification code sent to your phone');
        setStep('verify');
      } else {
        toast.error(data.message || 'Failed to send SMS code');
      }
    } catch (error) {
      toast.error('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyAndEnable = async () => {
    if (!verificationCode) {
      toast.error('Please enter the verification code');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/2fa/verify-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          code: verificationCode,
          method: setupMethod,
          ...(setupMethod === 'sms' && { phoneNumber })
        })
      });

      const data = await response.json();
      if (response.ok) {
        setIsEnabled(true);
        setBackupCodes(data.backupCodes);
        setStep('complete');
        setShowBackupCodes(true);
        toast.success('Two-factor authentication enabled successfully');
        onUpdate?.();
      } else {
        toast.error(data.message || 'Invalid verification code');
      }
    } catch (error) {
      toast.error('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const disable2FA = async () => {
    if (!currentPassword || !verificationCode) {
      toast.error('Please provide both password and 2FA code');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          password: currentPassword,
          code: verificationCode
        })
      });

      const data = await response.json();
      if (response.ok) {
        setIsEnabled(false);
        setShowDisableConfirm(false);
        setCurrentPassword('');
        setVerificationCode('');
        setStep('overview');
        toast.success('Two-factor authentication disabled');
        onUpdate?.();
      } else {
        toast.error(data.message || 'Failed to disable 2FA');
      }
    } catch (error) {
      toast.error('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const regenerateBackupCodes = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/2fa/regenerate-backup-codes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (response.ok) {
        setBackupCodes(data.codes);
        setShowBackupCodes(true);
        toast.success('New backup codes generated');
      } else {
        toast.error(data.message || 'Failed to regenerate codes');
      }
    } catch (error) {
      toast.error('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const copyAllBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    copyToClipboard(codesText);
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Shield className={`h-8 w-8 ${isEnabled ? 'text-green-500' : 'text-gray-400'}`} />
        <div>
          <h3 className="text-lg font-medium text-gray-900">Two-Factor Authentication</h3>
          <p className="text-sm text-gray-500">
            {isEnabled 
              ? 'Your account is protected with 2FA' 
              : 'Add an extra layer of security to your account'}
          </p>
        </div>
      </div>

      {!isEnabled ? (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-900">
                  Secure your account with 2FA
                </h4>
                <p className="text-sm text-blue-700 mt-1">
                  Two-factor authentication adds an extra layer of security by requiring 
                  a second form of verification when signing in.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
              <div className="flex items-center space-x-3 mb-3">
                <Smartphone className="h-6 w-6 text-gray-700" />
                <h4 className="font-medium text-gray-900">Authenticator App</h4>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Use an app like Google Authenticator or Authy to generate verification codes.
              </p>
              <button
                onClick={initiateTOTPSetup}
                disabled={isLoading}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Set up Authenticator
              </button>
            </div>

            <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
              <div className="flex items-center space-x-3 mb-3">
                <Key className="h-6 w-6 text-gray-700" />
                <h4 className="font-medium text-gray-900">SMS Verification</h4>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Receive verification codes via text message to your phone.
              </p>
              <button
                onClick={initiateSMSSetup}
                disabled={isLoading}
                className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 disabled:opacity-50"
              >
                Set up SMS
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Check className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium text-green-900">
                Two-factor authentication is enabled
              </span>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => setShowBackupCodes(true)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              View Backup Codes
            </button>
            <button
              onClick={regenerateBackupCodes}
              disabled={isLoading}
              className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4 inline mr-2" />
              Regenerate Codes
            </button>
            <button
              onClick={() => setShowDisableConfirm(true)}
              className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50"
            >
              Disable 2FA
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderSetup = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <button
          onClick={() => setStep('overview')}
          className="text-gray-500 hover:text-gray-700"
        >
          ← Back
        </button>
        <h3 className="text-lg font-medium text-gray-900">
          Setup {setupMethod === 'totp' ? 'Authenticator App' : 'SMS Verification'}
        </h3>
      </div>

      {setupMethod === 'totp' ? (
        <div className="space-y-4">
          <div className="text-center">
            <div className="inline-block p-4 bg-white border border-gray-200 rounded-lg">
              <QRCodeSVG value={qrCode} size={200} />
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Scan this QR code with your authenticator app
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm font-medium text-gray-900 mb-2">
              Can't scan? Enter this key manually:
            </p>
            <div className="flex items-center space-x-2">
              <code className="flex-1 text-sm bg-white p-2 rounded border font-mono">
                {secret}
              </code>
              <button
                onClick={() => copyToClipboard(secret)}
                className="p-2 text-gray-500 hover:text-gray-700"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Enter verification code from your app:
            </label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="000000"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={6}
            />
          </div>

          <button
            onClick={verifyAndEnable}
            disabled={isLoading || !verificationCode}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Verifying...' : 'Verify and Enable'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Phone Number:
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={sendSMSCode}
            disabled={isLoading || !phoneNumber}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Sending...' : 'Send Verification Code'}
          </button>
        </div>
      )}
    </div>
  );

  const renderVerify = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <button
          onClick={() => setStep('setup')}
          className="text-gray-500 hover:text-gray-700"
        >
          ← Back
        </button>
        <h3 className="text-lg font-medium text-gray-900">Verify Your Phone</h3>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          We sent a verification code to {phoneNumber}
        </p>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Enter verification code:
          </label>
          <input
            type="text"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            placeholder="000000"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={6}
          />
        </div>

        <div className="flex space-x-3">
          <button
            onClick={verifyAndEnable}
            disabled={isLoading || !verificationCode}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Verifying...' : 'Verify and Enable'}
          </button>
          <button
            onClick={sendSMSCode}
            disabled={isLoading}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Resend Code
          </button>
        </div>
      </div>
    </div>
  );

  const renderComplete = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
          <Check className="h-6 w-6 text-green-600" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mt-4">
          Two-Factor Authentication Enabled!
        </h3>
        <p className="text-sm text-gray-600 mt-2">
          Your account is now protected with an additional layer of security.
        </p>
      </div>

      <button
        onClick={() => setStep('overview')}
        className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
      >
        Done
      </button>
    </div>
  );

  const renderBackupCodes = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Backup Recovery Codes</h3>
          <button
            onClick={() => setShowBackupCodes(false)}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-yellow-900">
                  Save these codes safely
                </h4>
                <p className="text-sm text-yellow-700 mt-1">
                  Each code can only be used once. Keep them in a secure location.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-2 font-mono text-sm">
              {backupCodes.map((code, index) => (
                <div key={index} className="bg-white p-2 rounded border">
                  {code}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={copyAllBackupCodes}
            className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
          >
            <Copy className="h-4 w-4 inline mr-2" />
            Copy All Codes
          </button>
        </div>
      </div>
    </div>
  );

  const renderDisableConfirm = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Disable Two-Factor Authentication</h3>
          <button
            onClick={() => setShowDisableConfirm(false)}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-red-900">
                  This will reduce your account security
                </h4>
                <p className="text-sm text-red-700 mt-1">
                  Your account will only be protected by your password.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Current Password:
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                2FA Code:
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="000000"
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={6}
              />
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => setShowDisableConfirm(false)}
              className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={disable2FA}
              disabled={isLoading || !currentPassword || !verificationCode}
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {isLoading ? 'Disabling...' : 'Disable 2FA'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      {step === 'overview' && renderOverview()}
      {step === 'setup' && renderSetup()}
      {step === 'verify' && renderVerify()}
      {step === 'complete' && renderComplete()}
      {showBackupCodes && renderBackupCodes()}
      {showDisableConfirm && renderDisableConfirm()}
    </div>
  );
};

export default TwoFactorAuth;