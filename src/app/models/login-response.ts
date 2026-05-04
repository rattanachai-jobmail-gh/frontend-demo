export interface LoginResponse {
    message: string;
    authenticated: boolean;
    username: string;
    roles: string[];
}
