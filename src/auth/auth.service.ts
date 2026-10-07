import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EmploymentStatus } from '../employees/employee.entity';
import { AuthRepository } from './auth.repository';
import { PasswordService } from './password.service';
import type { LoginDto } from './dto/login.dto';
import type { LoginResponseDto } from './dto/login-response.dto';

@Injectable()
export class AuthService {
    constructor(
        private readonly authRepository: AuthRepository,
        private readonly passwordService: PasswordService,
        private readonly jwtService: JwtService,
        private readonly config: ConfigService,
    ) {}

    async login(body: LoginDto): Promise<LoginResponseDto> {
        const credentials = await this.authRepository.findCredentialsByWorkEmail(
            body.workEmail,
        );

        if (!credentials || credentials.passwordHash === null) {
            await this.passwordService.verifyDummy(body.password);
            throw new UnauthorizedException('Invalid credentials.');
        }

        const passwordMatches = await this.passwordService.verify(
            body.password,
            credentials.passwordHash,
        );

        if (
            !passwordMatches ||
            credentials.employmentStatus !== EmploymentStatus.ACTIVE
        ) {
            throw new UnauthorizedException('Invalid credentials.');
        }

        const expiresIn = this.config.getOrThrow<number>('JWT_EXPIRES_IN_SECONDS');
        const accessToken = await this.jwtService.signAsync({ sub: credentials.id });

        return {
            accessToken,
            tokenType: 'Bearer',
            expiresIn,
        };
    }
}
