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
import * as schema from '../db/schema';
import { DATABASE_CONNECTION } from '../db/database.providers';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AssetsService } from '../assets/assets.service';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private db: NodePgDatabase<typeof schema>,
    private assetsService: AssetsService,
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
    const { password, passwordResetToken, emailVerificationToken, ...profile } =
      user;

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

    // If updating email, check for conflicts
    if (updateDto.email && updateDto.email !== existingUser.email) {
      const [emailConflict] = await this.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, updateDto.email))
        .limit(1);

      if (emailConflict) {
        throw new ConflictException('Email is already in use');
      }

      // If email is changed, mark as unverified
      const [updatedUser] = await this.db
        .update(schema.users)
        .set({
          ...updateDto,
          isEmailVerified: false,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, userId))
        .returning();

      const {
        password,
        passwordResetToken,
        emailVerificationToken,
        ...profile
      } = updatedUser;

      return {
        ...profile,
        message:
          'Profile updated. Please verify your new email address.',
      };
    }

    // Update profile without email change
    const [updatedUser] = await this.db
      .update(schema.users)
      .set({
        ...updateDto,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId))
      .returning();

    const {
      password,
      passwordResetToken,
      emailVerificationToken,
      ...profile
    } = updatedUser;

    return profile;
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

    // Note: This assumes avatarUrl field exists in users table
    // If not, we need to add it to the schema first
    // For now, we'll store it in metadata or another field
    // TODO: Add avatarUrl field to users table schema

    return {
      message: 'Avatar uploaded successfully',
      avatarUrl: fileUrl,
    };
  }
}
