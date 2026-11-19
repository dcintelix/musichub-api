import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  fullName!: string;

  @IsString()
  username!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsIn(['Musician', 'EventOrganizer'])
  accountType!: 'Musician' | 'EventOrganizer';

  @IsString()
  @MinLength(8)
  password!: string;
}
