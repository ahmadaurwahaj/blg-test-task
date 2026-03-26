import { IsUrl } from 'class-validator';

export class AnalyzeUrlDto {
  @IsUrl()
  url!: string;
}
