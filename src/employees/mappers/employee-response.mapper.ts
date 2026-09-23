import {
    employeeResponseSchema,
    type EmployeeResponseDto,
} from '../dto/responses/employee-response.dto';

export function toEmployeeResponse(
    value: unknown,
): EmployeeResponseDto {
    return employeeResponseSchema.parse(value);
}