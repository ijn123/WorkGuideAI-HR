import type { IncomingHttpHeaders } from 'node:http';
import type { AuthenticatedUser } from './authenticated-user';

export interface AuthenticatedRequest {
    headers: IncomingHttpHeaders;
    rawHeaders?: string[];
    user?: AuthenticatedUser;
}
