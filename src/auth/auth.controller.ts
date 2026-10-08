import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Post,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import type { LoginResponseDto } from './dto/login-response.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('login')
    @HttpCode(HttpStatus.OK)
    login(
        @Body()
        body: LoginDto,
    ): Promise<LoginResponseDto> {
        return this.authService.login(body);
    }
}
