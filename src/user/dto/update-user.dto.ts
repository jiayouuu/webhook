import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  avatar?: string;
}
