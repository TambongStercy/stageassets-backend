import {
  Controller,
  Get,
  Put,
  Delete,
  Post,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RequestEmailChangeDto, ConfirmEmailChangeDto } from './dto/change-email.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * User profile management endpoints
 * All endpoints require authentication except confirm-email-change
 */
@Controller('users/profile')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get current user profile
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    return this.usersService.getProfile(req.user.id);
  }

  /**
   * Update user profile (name only, NOT email)
   * To change email, use /request-email-change endpoint
   */
  @Put()
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Request() req, @Body() updateDto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.id, updateDto);
  }

  /**
   * Request email change - sends verification to NEW email
   * Requires authentication
   */
  @Post('request-email-change')
  @UseGuards(JwtAuthGuard)
  async requestEmailChange(
    @Request() req,
    @Body() dto: RequestEmailChangeDto,
  ) {
    return this.usersService.requestEmailChange(req.user.id, dto);
  }

  /**
   * Confirm email change - public endpoint with token
   * No auth required (token provides authentication)
   */
  @Get('confirm-email-change')
  async confirmEmailChange(@Query() dto: ConfirmEmailChangeDto) {
    return this.usersService.confirmEmailChange(dto);
  }

  /**
   * Change password (for email/password accounts only)
   */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(req.user.id, changePasswordDto);
  }

  /**
   * Upload profile picture/avatar
   */
  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
      },
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          return callback(
            new BadRequestException('Only image files are allowed for avatar'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadAvatar(
    @Request() req,
    @UploadedFile() avatar: Express.Multer.File,
  ) {
    if (!avatar) {
      throw new BadRequestException('Avatar file is required');
    }
    return this.usersService.uploadAvatar(req.user.id, avatar);
  }

  /**
   * Delete account (soft delete)
   */
  @Delete()
  @UseGuards(JwtAuthGuard)
  async deleteAccount(@Request() req) {
    return this.usersService.deleteAccount(req.user.id);
  }
}
