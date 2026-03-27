import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly usageMap = new Map<string, number>();
  private readonly maxCalls: number;
  private readonly whitelistedIps: Set<string>;

  constructor(private readonly config: ConfigService) {
    this.maxCalls = this.config.get<number>('RATE_LIMIT_MAX_CALLS', 3);
    const raw = this.config.get<string>('WHITELISTED_IPS', '');
    this.whitelistedIps = new Set(
      raw
        .split(',')
        .map((ip) => ip.trim())
        .filter(Boolean),
    );
  }

  enforce(request: Request): void {
    const ip = this.extractIp(request);

    if (this.whitelistedIps.has(ip)) return;

    const currentUsage = this.usageMap.get(ip) ?? 0;

    if (currentUsage >= this.maxCalls) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Rate limit exceeded. You have used all ${this.maxCalls} free analysis calls.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.usageMap.set(ip, currentUsage + 1);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    this.enforce(request);
    return true;
  }

  private extractIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
    if (Array.isArray(forwarded)) return forwarded[0];
    return request.ip ?? request.socket.remoteAddress ?? 'unknown';
  }
}
