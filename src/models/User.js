const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false
  },
  role: {
    type: String,
    enum: ['customer', 'admin', 'vendor'],
    default: 'customer'
  },
  phone: {
    type: String,
    trim: true,
    match: [/^\+?[\d\s\-\(\)]+$/, 'Please enter a valid phone number']
  },
  dateOfBirth: {
    type: Date
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  profileImage: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  passwordResetToken: String,
  passwordResetExpires: Date,
  lastLogin: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  // Two-Factor Authentication fields
  twoFactor: {
    isEnabled: {
      type: Boolean,
      default: false
    },
    secret: {
      type: String,
      select: false
    },
    backupCodes: [{
      code: {
        type: String,
        select: false
      },
      used: {
        type: Boolean,
        default: false
      },
      usedAt: Date
    }],
    enabledAt: Date,
    lastUsed: Date
  },
  twoFactorAttempts: {
    type: Number,
    default: 0
  },
  twoFactorLockUntil: Date,
  // Customer specific fields
  wishlist: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  cart: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    quantity: {
      type: Number,
      default: 1
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Vendor specific fields
  vendorInfo: {
    businessName: String,
    businessLicense: String,
    taxId: String,
    bankAccount: {
      accountNumber: String,
      routingNumber: String,
      accountHolderName: String
    },
    commission: {
      type: Number,
      default: 15
    },
    isApproved: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ 'twoFactor.isEnabled': 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Virtual for 2FA lock status
userSchema.virtual('isTwoFactorLocked').get(function() {
  return !!(this.twoFactorLockUntil && this.twoFactorLockUntil > Date.now());
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to hash backup codes
userSchema.pre('save', async function(next) {
  if (!this.isModified('twoFactor.backupCodes')) return next();
  
  try {
    for (let i = 0; i < this.twoFactor.backupCodes.length; i++) {
      const backupCode = this.twoFactor.backupCodes[i];
      if (backupCode.isModified && backupCode.isModified('code')) {
        const salt = await bcrypt.genSalt(12);
        backupCode.code = await bcrypt.hash(backupCode.code, salt);
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Method to increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = {
      lockUntil: Date.now() + 2 * 60 * 60 * 1000 // 2 hours
    };
  }

  return this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Method to increment 2FA attempts
userSchema.methods.incTwoFactorAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.twoFactorLockUntil && this.twoFactorLockUntil < Date.now()) {
    return this.updateOne({
      $unset: { twoFactorLockUntil: 1 },
      $set: { twoFactorAttempts: 1 }
    });
  }

  const updates = { $inc: { twoFactorAttempts: 1 } };
  
  // Lock 2FA after 5 failed attempts for 15 minutes
  if (this.twoFactorAttempts + 1 >= 5 && !this.isTwoFactorLocked) {
    updates.$set = {
      twoFactorLockUntil: Date.now() + 15 * 60 * 1000 // 15 minutes
    };
  }

  return this.updateOne(updates);
};

// Method to reset 2FA attempts
userSchema.methods.resetTwoFactorAttempts = function() {
  return this.updateOne({
    $unset: { twoFactorAttempts: 1, twoFactorLockUntil: 1 }
  });
};

// Method to enable 2FA
userSchema.methods.enableTwoFactor = function(secret, backupCodes) {
  this.twoFactor.isEnabled = true;
  this.twoFactor.secret = secret;
  this.twoFactor.backupCodes = backupCodes.map(code => ({
    code,
    used: false
  }));
  this.twoFactor.enabledAt = new Date();
  
  return this.save();
};

// Method to disable 2FA
userSchema.methods.disableTwoFactor = function() {
  this.twoFactor.isEnabled = false;
  this.twoFactor.secret = undefined;
  this.twoFactor.backupCodes = [];
  this.twoFactor.enabledAt = undefined;
  this.twoFactor.lastUsed = undefined;
  
  return this.save();
};

// Method to use backup code
userSchema.methods.useBackupCode = async function(candidateCode) {
  if (!this.twoFactor.isEnabled || !this.twoFactor.backupCodes.length) {
    return false;
  }

  for (let backupCode of this.twoFactor.backupCodes) {
    if (!backupCode.used) {
      const isMatch = await bcrypt.compare(candidateCode, backupCode.code);
      if (isMatch) {
        backupCode.used = true;
        backupCode.usedAt = new Date();
        this.twoFactor.lastUsed = new Date();
        await this.save();
        return true;
      }
    }
  }
  
  return false;
};

// Method to regenerate backup codes
userSchema.methods.regenerateBackupCodes = function(newBackupCodes) {
  this.twoFactor.backupCodes = newBackupCodes.map(code => ({
    code,
    used: false
  }));
  
  return this.save();
};

// Method to get unused backup codes count
userSchema.methods.getUnusedBackupCodesCount = function() {
  if (!this.twoFactor.backupCodes) return 0;
  return this.twoFactor.backupCodes.filter(code => !code.used).length;
};

// Method to add item to cart
userSchema.methods.addToCart = function(productId, quantity = 1) {
  const existingItem = this.cart.find(item => 
    item.product.toString() === productId.toString()
  );

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    this.cart.push({ product: productId, quantity });
  }

  return this.save();
};

// Method to remove item from cart
userSchema.methods.removeFromCart = function(productId) {
  this.cart = this.cart.filter(item => 
    item.product.toString() !== productId.toString()
  );
  return this.save();
};

// Method to clear cart
userSchema.methods.clearCart = function() {
  this.cart = [];
  return this.save();
};

// Method to add item to wishlist
userSchema.methods.addToWishlist = function(productId) {
  if (!this.wishlist.includes(productId)) {
    this.wishlist.push(productId);
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to remove item from wishlist
userSchema.methods.removeFromWishlist = function(productId) {
  this.wishlist = this.wishlist.filter(id => 
    id.toString() !== productId.toString()
  );
  return this.save();
};

// Method to generate password reset token
userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return resetToken;
};

// Method to generate email verification token
userSchema.methods.createEmailVerificationToken = function() {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  
  return verificationToken;
};

// Method to generate backup codes
userSchema.methods.generateBackupCodes = function(count = 8) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric backup codes
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
};

// Static method to find user by credentials
userSchema.statics.findByCredentials = async function(email, password) {
  const user = await this.findOne({ 
    email, 
    isActive: true 
  }).select('+password');
  
  if (!user) {
    throw new Error('Invalid login credentials');
  }

  if (user.isLocked) {
    await user.incLoginAttempts();
    throw new Error('Account temporarily locked due to too many failed login attempts');
  }

  const isMatch = await user.comparePassword(password);
  
  if (!isMatch) {
    await user.incLoginAttempts();
    throw new Error('Invalid login credentials');
  }

  // Reset login attempts on successful login
  if (user.loginAttempts > 0) {
    await user.resetLoginAttempts();
  }

  // Update last login only if 2FA is disabled or after 2FA verification
  if (!user.twoFactor.isEnabled) {
    user.lastLogin = new Date();
    await user.save();
  }

  return user;
};

// Static method to get users by role
userSchema.statics.findByRole = function(role) {
  return this.find({ role, isActive: true });
};

// Remove sensitive data from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  
  delete user.password;
  delete user.passwordResetToken;
  delete user.passwordResetExpires;
  delete user.emailVerificationToken;
  delete user.loginAttempts;
  delete user.lockUntil;
  delete user.twoFactorAttempts;
  delete user.twoFactorLockUntil;
  
  // Remove sensitive 2FA data
  if (user.twoFactor) {
    delete user.twoFactor.secret;
    delete user.twoFactor.backupCodes;
    // Only keep public 2FA info
    user.twoFactor = {
      isEnabled: user.twoFactor.isEnabled,
      enabledAt: user.twoFactor.enabledAt,
      lastUsed: user.twoFactor.lastUsed
    };
  }
  
  return user;
};

module.exports = mongoose.model('User', userSchema);