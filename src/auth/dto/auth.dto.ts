import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Format email invalide' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Le mot de passe doit comporter au moins 6 caractères' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  name: string;

  @IsString()
  @IsOptional()
  role?: string; // "admin" | "tech" | "researcher" | "public"
}

export class LoginDto {
  @IsEmail({}, { message: 'Format email invalide' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire' })
  password: string;
}
