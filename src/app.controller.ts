import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
    @Get()
    getStatus() {
        return {
            name: 'WorkGuide AI',
            status: 'ok',
            description: 'HR-ассистент',
        };
    }
}