import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateBy } from 'class-validator';

export class AskQuestionDto {
    @Transform(({ value }: { value: unknown }) =>
        typeof value === 'string' ? value.trim() : value,
    )
    @IsString()
    @IsNotEmpty()
    // Preserve the previous schema's UTF-16 length limit, including emoji.
    @ValidateBy({
        name: 'questionLength',
        validator: {
            validate: (value: unknown) =>
                typeof value === 'string' && value.length <= 4000,
            defaultMessage: () =>
                'Question must not exceed 4000 UTF-16 code units.',
        },
    })
    question!: string;
}
