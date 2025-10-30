import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as schema from '../db/schema';
import { DATABASE_CONNECTION } from '../db/database.providers';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RequestEmailChangeDto, ConfirmEmailChangeDto } from './dto/change-email.dto';
import { AssetsService } from '../assets/assets.service';
import { EmailsService } from '../emails/emails.service';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private db: NodePgDatabase<typeof schema>,
    private assetsService: AssetsService,
    private emailsService: EmailsService,
  ) {}

  async getProfile(userId: number) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Don't return sensitive information
    const {
      password,
      passwordResetToken,
      emailVerificationToken,
      emailChangeToken,
      ...profile
    } = user;

    return profile;
  }

  async updateProfile(userId: number, updateDto: UpdateProfileDto) {
    // Check if user exists
    const [existingUser] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    // Remove email from updateDto if present - use requestEmailChange instead
    const { email, ...safeUpdateDto } = updateDto;

    if (email) {
      throw new BadRequestException(
        'To change your email, please use the /users/profile/request-email-change endpoint'
      );
    }

    // Update profile (name only, not email)
    const [updatedUser] = await this.db
      .update(schema.users)
      .set({
        ...safeUpdateDto,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId))
      .returning();

    const {
      password,
      passwordResetToken,
      emailVerificationToken,
      emailChangeToken,
      ...profile
    } = updatedUser;

    return profile;
  }

  async requestEmailChange(userId: number, dto: RequestEmailChangeDto) {
    const { newEmail } = dto;

    // Get current user
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if new email is same as current
    if (newEmail === user.email) {
      throw new BadRequestException('New email is the same as current email');
    }

    // Check if email is already in use
    const [emailConflict] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, newEmail))
      .limit(1);

    if (emailConflict) {
      throw new ConflictException('Email is already in use');
    }

    // Generate email change token
    const changeToken = crypto.randomBytes(32).toString('hex');
    const changeExpiry = new Date(Date.now() + 3600000); // 1 hour

    // Store pending email and token
    await this.db
      .update(schema.users)
      .set({
        pendingEmail: newEmail,
        emailChangeToken: changeToken,
        emailChangeExpires: changeExpiry,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId));

    // Send verification email to NEW email address
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const verificationUrl = `${frontendUrl}/confirm-email-change?token=${changeToken}`;

    await this.emailsService.sendEmailChangeVerification(
      newEmail,
      user.firstName || 'User',
      verificationUrl,
    );

    return {
      message: `Verification email sent to ${newEmail}. Please check your inbox to confirm the email change.`,
    };
  }

  async confirmEmailChange(dto: ConfirmEmailChangeDto) {
    const { token } = dto;

    // Find user by email change token
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.emailChangeToken, token))
      .limit(1);

    if (!user) {
      throw new BadRequestException('Invalid or expired email change token');
    }

    // Check if token has expired
    if (!user.emailChangeExpires || user.emailChangeExpires < new Date()) {
      throw new BadRequestException('Email change token has expired');
    }

    // Check if pending email is set
    if (!user.pendingEmail) {
      throw new BadRequestException('No pending email change found');
    }

    // Check again if new email is still available
    const [emailConflict] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, user.pendingEmail))
      .limit(1);

    if (emailConflict) {
      throw new ConflictException('Email is no longer available');
    }

    // Update email and clear pending change
    await this.db
      .update(schema.users)
      .set({
        email: user.pendingEmail,
        pendingEmail: null,
        emailChangeToken: null,
        emailChangeExpires: null,
        isEmailVerified: true, // New email is verified through this process
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, user.id));

    return {
      message: 'Email has been changed successfully',
      newEmail: user.pendingEmail,
    };
  }

  async changePassword(userId: number, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    // Get user with password
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user has a password (Google OAuth users don't)
    if (!user.password) {
      throw new BadRequestException(
        'Cannot change password for accounts created with Google OAuth',
      );
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await this.db
      .update(schema.users)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId));

    return {
      message: 'Password has been changed successfully',
    };
  }

  async deleteAccount(userId: number) {
    // Check if user exists
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Soft delete by marking as inactive
    // This preserves data integrity and allows for account recovery
    await this.db
      .update(schema.users)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId));

    return {
      message: 'Account has been deactivated successfully',
    };
  }

  async uploadAvatar(userId: number, file: Express.Multer.File) {
    // Check if user exists
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Save avatar file
    const { fileUrl } = await this.assetsService.saveFile(file, 'avatars');

    // Update user's avatarUrl
    await this.db
      .update(schema.users)
      .set({
        avatarUrl: fileUrl,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId));

    return {
      message: 'Avatar uploaded successfully',
      avatarUrl: fileUrl,
    };
  }
}
