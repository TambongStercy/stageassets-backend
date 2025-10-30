import {
  Injectable,
  Inject,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as schema from '../db/schema';
import { DATABASE_CONNECTION } from '../db/database.providers';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { EmailsService } from '../emails/emails.service';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private db: NodePgDatabase<typeof schema>,
    private jwtService: JwtService,
    private emailsService: EmailsService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, firstName, lastName } = registerDto;

    // Check if user already exists
    const existingUser = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await this.db
      .insert(schema.users)
      .values({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        isActive: true,
        isEmailVerified: false,
      })
      .returning();

    const newUser = result[0];

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 86400000); // 24 hours

    // Save verification token to database
    await this.db
      .update(schema.users)
      .set({
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpiry,
      })
      .where(eq(schema.users.id, newUser.id));

    // Send verification email
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

    await this.emailsService.sendEmailVerification(
      newUser.email,
      newUser.firstName || 'User',
      verificationUrl,
    );

    // Generate JWT token
    const token = this.generateToken(newUser);

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
      },
      token,
      message: 'Registration successful. Please check your email to verify your account.',
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password || '');
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.db
      .update(schema.users)
      .set({ lastLoginAt: new Date() })
      .where(eq(schema.users.id, user.id));

    // Generate JWT token
    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      token,
    };
  }

  async validateUser(userId: number) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user || !user.isActive) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }

  async googleLogin(googleUser: any) {
    const { googleId, email, firstName, lastName, picture } = googleUser;

    // Check if user exists by googleId first
    let [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.googleId, googleId))
      .limit(1);

    if (!user) {
      // Check by email in case user registered with email/password first
      [user] = await this.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1);
    }

    if (!user) {
      // Create new user for Google OAuth (no password needed)
      const result = await this.db
        .insert(schema.users)
        .values({
          googleId,
          email,
          password: null, // Google OAuth users don't have passwords
          firstName,
          lastName,
          avatarUrl: picture || null,
          isActive: true,
          isEmailVerified: true, // Google emails are already verified
        })
        .returning();

      user = result[0];
    } else {
      // Update existing user with Google ID and avatar if not already set
      const updateData: any = {
        lastLoginAt: new Date(),
      };

      // Link Google account if not already linked
      if (!user.googleId) {
        updateData.googleId = googleId;
      }

      // Update avatar if available and not already set
      if (picture && !user.avatarUrl) {
        updateData.avatarUrl = picture;
      }

      // Update email verification if logging in with Google
      if (!user.isEmailVerified) {
        updateData.isEmailVerified = true;
      }

      await this.db
        .update(schema.users)
        .set(updateData)
        .where(eq(schema.users.id, user.id));

      // Refresh user data after update
      [user] = await this.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, user.id))
        .limit(1);
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Generate JWT token
    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
      },
      token,
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    // Find user
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    // Don't reveal if email exists or not (security best practice)
    if (!user) {
      return {
        message:
          'If an account with that email exists, a password reset link has been sent',
      };
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    // Save token to database
    await this.db
      .update(schema.users)
      .set({
        passwordResetToken: resetToken,
        passwordResetExpires: resetTokenExpiry,
      })
      .where(eq(schema.users.id, user.id));

    // Send password reset email
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    await this.emailsService.sendPasswordReset(
      user.email,
      user.firstName || 'User',
      resetUrl,
    );

    return {
      message:
        'If an account with that email exists, a password reset link has been sent',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword } = resetPasswordDto;

    // Find user by reset token
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.passwordResetToken, token))
      .limit(1);

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Check if token has expired
    if (
      !user.passwordResetExpires ||
      user.passwordResetExpires < new Date()
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    await this.db
      .update(schema.users)
      .set({
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      })
      .where(eq(schema.users.id, user.id));

    return {
      message: 'Password has been reset successfully',
    };
  }

  async resendVerificationEmail(resendDto: ResendVerificationDto) {
    const { email } = resendDto;

    // Find user
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    // Don't reveal if email exists or not (security best practice)
    if (!user) {
      return {
        message:
          'If an account with that email exists and is not verified, a verification link has been sent',
      };
    }

    // Check if already verified
    if (user.isEmailVerified) {
      return {
        message: 'Email is already verified',
      };
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 86400000); // 24 hours

    // Save token to database
    await this.db
      .update(schema.users)
      .set({
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpiry,
      })
      .where(eq(schema.users.id, user.id));

    // Send verification email
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

    await this.emailsService.sendEmailVerification(
      user.email,
      user.firstName || 'User',
      verificationUrl,
    );

    return {
      message:
        'If an account with that email exists and is not verified, a verification link has been sent',
    };
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const { token } = verifyEmailDto;

    // Find user by verification token
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.emailVerificationToken, token))
      .limit(1);

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    // Check if token has expired
    if (
      !user.emailVerificationExpires ||
      user.emailVerificationExpires < new Date()
    ) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    // Check if already verified
    if (user.isEmailVerified) {
      return {
        message: 'Email is already verified',
      };
    }

    // Mark email as verified and clear verification token
    await this.db
      .update(schema.users)
      .set({
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      })
      .where(eq(schema.users.id, user.id));

    return {
      message: 'Email has been verified successfully',
    };
  }

  private generateToken(user: any) {
    const payload = { sub: user.id, email: user.email };
    return this.jwtService.sign(payload);
  }
}
