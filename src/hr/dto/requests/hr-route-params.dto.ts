import { IsString, IsUUID, ValidateBy } from 'class-validator';

export class EmployeeRouteParamsDto {
    @IsUUID('4')
    employeeId!: string;
}

export class LeaveBalanceRouteParamsDto extends EmployeeRouteParamsDto {
    @IsString()
    @ValidateBy({
        name: 'routeYear',
        validator: {
            // Keep the raw string until validation has checked its representation.
            validate: (value: unknown) =>
                typeof value === 'string'
                && value.trim() === value
                && /^-?\d+$/.test(value)
                && Number(value) >= 2000
                && Number(value) <= 2100,
            defaultMessage: () =>
                'year must be a decimal integer between 2000 and 2100.',
        },
    })
    year!: string;
}
