import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';
import { AuthRepository } from './auth.repository';
import { PasswordService } from './password.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';

@Module({
    imports: [
        DatabaseModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                secret: config.getOrThrow<string>('JWT_SECRET'),
                signOptions: {
                    algorithm: 'HS256',
                    expiresIn: config.getOrThrow<number>('JWT_EXPIRES_IN_SECONDS'),
                },
            }),
        }),
    ],
    controllers: [AuthController],
    providers: [AuthRepository, PasswordService, AuthService, AuthGuard],
    exports: [AuthRepository, PasswordService, AuthGuard, JwtModule],
})
export class AuthModule {}
