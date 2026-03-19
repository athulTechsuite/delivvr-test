const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
  twoFactorAuth: {
    isEnabled: {
      type: Boolean,
      default: false
    },
    secret: {
      type: String,
      select: false // Don't include in queries by default for security
    },
    backupCodes: [{
      code: {
        type: String,
        select: false
      },
      isUsed: {
        type: Boolean,
        default: false
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    enabledAt: Date,
    lastUsed: Date
  },
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
userSchema.index({ 'twoFactorAuth.isEnabled': 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Virtual for 2FA status
userSchema.virtual('has2FA').get(function() {
  return this.twoFactorAuth && this.twoFactorAuth.isEnabled;
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
  if (!this.isModified('twoFactorAuth.backupCodes')) return next();
  
  try {
    if (this.twoFactorAuth && this.twoFactorAuth.backupCodes) {
      for (let backupCode of this.twoFactorAuth.backupCodes) {
        if (!backupCode.code.startsWith('$2a$')) { // Only hash if not already hashed
          const salt = await bcrypt.genSalt(10);
          backupCode.code = await bcrypt.hash(backupCode.code, salt);
        }
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

// Method to compare backup code
userSchema.methods.compareBackupCode = async function(candidateCode) {
  try {
    if (!this.twoFactorAuth || !this.twoFactorAuth.backupCodes) {
      return null;
    }

    for (let backupCode of this.twoFactorAuth.backupCodes) {
      if (!backupCode.isUsed) {
        const isMatch = await bcrypt.compare(candidateCode, backupCode.code);
        if (isMatch) {
          return backupCode;
        }
      }
    }
    return null;
  } catch (error) {
    throw new Error('Backup code comparison failed');
  }
};

// Method to enable 2FA
userSchema.methods.enable2FA = function(secret, backupCodes = []) {
  this.twoFactorAuth = {
    isEnabled: true,
    secret: secret,
    backupCodes: backupCodes.map(code => ({ code })),
    enabledAt: new Date()
  };
  return this.save();
};

// Method to disable 2FA
userSchema.methods.disable2FA = function() {
  this.twoFactorAuth = {
    isEnabled: false,
    secret: undefined,
    backupCodes: [],
    enabledAt: undefined,
    lastUsed: this.twoFactorAuth?.lastUsed
  };
  return this.save();
};

// Method to use backup code
userSchema.methods.useBackupCode = function(backupCodeId) {
  if (this.twoFactorAuth && this.twoFactorAuth.backupCodes) {
    const backupCode = this.twoFactorAuth.backupCodes.id(backupCodeId);
    if (backupCode) {
      backupCode.isUsed = true;
      this.twoFactorAuth.lastUsed = new Date();
      return this.save();
    }
  }
  throw new Error('Backup code not found');
};

// Method to generate new backup codes
userSchema.methods.generateBackupCodes = function() {
  const crypto = require('crypto');
  const backupCodes = [];
  
  for (let i = 0; i < 10; i++) {
    // Generate 8-character alphanumeric backup codes
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    backupCodes.push(code);
  }
  
  if (!this.twoFactorAuth) {
    this.twoFactorAuth = {};
  }
  
  this.twoFactorAuth.backupCodes = backupCodes.map(code => ({
    code,
    isUsed: false,
    createdAt: new Date()
  }));
  
  return { codes: backupCodes, save: () => this.save() };
};

// Method to update 2FA last used timestamp
userSchema.methods.update2FALastUsed = function() {
  if (this.twoFactorAuth) {
    this.twoFactorAuth.lastUsed = new Date();
    return this.save();
  }
  return Promise.resolve(this);
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
  const resetToken = require('crypto').randomBytes(32).toString('hex');
  
  this.passwordResetToken = require('crypto')
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return resetToken;
};

// Method to generate email verification token
userSchema.methods.createEmailVerificationToken = function() {
  const verificationToken = require('crypto').randomBytes(32).toString('hex');
  
  this.emailVerificationToken = require('crypto')
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  
  return verificationToken;
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

  // Update last login
  user.lastLogin = new Date();
  await user.save();

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
  
  // Remove sensitive 2FA data from JSON output
  if (user.twoFactorAuth) {
    delete user.twoFactorAuth.secret;
    delete user.twoFactorAuth.backupCodes;
    // Only show if 2FA is enabled and when it was enabled/last used
    user.twoFactorAuth = {
      isEnabled: user.twoFactorAuth.isEnabled,
      enabledAt: user.twoFactorAuth.enabledAt,
      lastUsed: user.twoFactorAuth.lastUsed
    };
  }
  
  return user;
};

module.exports = mongoose.model('User', userSchema);