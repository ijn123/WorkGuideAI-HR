import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, ValidateIf } from 'class-validator';

function shouldValidateField(body: UpdateHrRequestDto, value: unknown): boolean {
    // Skip absent fields only when at least one known field is supplied.
    return value !== undefined
        || [body.subject, body.description]
            .every((item) => item === undefined);
}

export class UpdateHrRequestDto {
    @ValidateIf(shouldValidateField)
    @Transform(({ value }: { value: unknown }) =>
        typeof value === 'string' ? value.trim() : value,
    )
    @IsString()
    @IsNotEmpty()
    // Count UTF-16 code units as the previous schema did; the value is trimmed.
    @Matches(/^[\s\S]{0,200}$/, {
        message: 'subject must not exceed 200 UTF-16 code units.',
    })
    subject?: string;

    @ValidateIf(shouldValidateField)
    @Transform(({ value }: { value: unknown }) =>
        typeof value === 'string' ? value.trim() : value,
    )
    @IsString()
    @IsNotEmpty()
    // Count UTF-16 code units as the previous schema did; the value is trimmed.
    @Matches(/^[\s\S]{0,5000}$/, {
        message: 'description must not exceed 5000 UTF-16 code units.',
    })
    description?: string;
}
