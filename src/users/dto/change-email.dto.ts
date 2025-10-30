import { IsEmail, IsString, IsNotEmpty } from 'class-validator';

export class RequestEmailChangeDto {
  @IsEmail()
  @IsNotEmpty()
  newEmail: string;
}

export class ConfirmEmailChangeDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
