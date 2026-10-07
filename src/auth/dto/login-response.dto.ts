export interface LoginResponseDto {
    accessToken: string;
    tokenType: 'Bearer';
    expiresIn: number;
}
