import { Controller, Get } from '@nestjs/common';
import type {
    AppStatusResponseDto,
} from './common/dto/responses/app-status-response.dto';

@Controller()
export class AppController {
    @Get()
    getStatus(): AppStatusResponseDto {
        return {
            name: 'WorkGuide AI',
            status: 'ok',
            description: 'HR-ассистент',
        };
    }
}