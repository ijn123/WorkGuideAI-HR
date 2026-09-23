import {
    hrRequestResponseSchema,
    type HrRequestResponseDto,
} from '../dto/responses/hr-request-response.dto';

export function toHrRequestResponse(
    value: unknown,
): HrRequestResponseDto {
    return hrRequestResponseSchema.parse(value);
}