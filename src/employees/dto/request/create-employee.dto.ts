import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreateEmployeeDto {
    @Transform(({ value }: { value: unknown }) =>
        typeof value === 'string' ? value.trim() : value,
    )
    @IsString()
    @IsNotEmpty()
    // Count UTF-16 code units as the previous schema did; the value is trimmed.
    @Matches(/^[\s\S]{0,100}$/, {
        message: 'firstName must not exceed 100 UTF-16 code units.',
    })
    firstName!: string;

    @Transform(({ value }: { value: unknown }) =>
        typeof value === 'string' ? value.trim() : value,
    )
    @IsString()
    @IsNotEmpty()
    // Count UTF-16 code units as the previous schema did; the value is trimmed.
    @Matches(/^[\s\S]{0,100}$/, {
        message: 'lastName must not exceed 100 UTF-16 code units.',
    })
    lastName!: string;

    @Transform(({ value }: { value: unknown }) =>
        typeof value === 'string' ? value.trim().toLowerCase() : value,
    )
    @IsString()
    @IsNotEmpty()
    // Preserve the email format accepted by the previous request schema.
    @Matches(
        /^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/,
        { message: 'workEmail must be an email' },
    )
    @MaxLength(254)
    workEmail!: string;

    @Transform(({ value }: { value: unknown }) =>
        typeof value === 'string' ? value.trim() : value,
    )
    @IsString()
    @IsNotEmpty()
    // Count UTF-16 code units as the previous schema did; the value is trimmed.
    @Matches(/^[\s\S]{0,100}$/, {
        message: 'department must not exceed 100 UTF-16 code units.',
    })
    department!: string;
}
