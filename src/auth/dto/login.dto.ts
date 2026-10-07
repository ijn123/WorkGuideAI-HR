import { Transform } from 'class-transformer';
import {
    IsNotEmpty,
    IsString,
    Matches,
    MaxLength,
    Validate,
    ValidatorConstraint,
    type ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'passwordByteLength', async: false })
class PasswordByteLengthConstraint implements ValidatorConstraintInterface {
    validate(value: unknown): boolean {
        return typeof value === 'string'
            && Buffer.byteLength(value, 'utf8') <= 1024;
    }

    defaultMessage(): string {
        return 'Password must not exceed 1024 UTF-8 bytes.';
    }
}

export class LoginDto {
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

    @IsString()
    @IsNotEmpty()
    @Validate(PasswordByteLengthConstraint)
    password!: string;
}
