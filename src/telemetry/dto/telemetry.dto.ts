import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class TelemetryDto {
  @IsNumber()
  @IsNotEmpty()
  temperature: number;

  @IsNumber()
  @IsOptional()
  temperature_bmp?: number;

  @IsNumber()
  @IsOptional()
  temperature_dht?: number;

  @IsNumber()
  @IsNotEmpty()
  humidity: number;

  @IsNumber()
  @IsOptional()
  pressure?: number;

  @IsNumber()
  @IsOptional()
  rain?: number;

  @IsString()
  @IsOptional()
  api_key?: string;

  @IsNumber()
  @IsOptional()
  battery_voltage?: number;

  @IsNumber()
  @IsOptional()
  gsm_signal?: number;

  @IsString()
  @IsOptional()
  gsm_operator?: string;

  @IsNumber()
  @IsOptional()
  lbs_lat?: number;

  @IsNumber()
  @IsOptional()
  lbs_lon?: number;
}
