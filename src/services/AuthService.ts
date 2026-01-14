import {
    CognitoIdentityProviderClient,
    SignUpCommand,
    InitiateAuthCommand,
    GlobalSignOutCommand,
    ConfirmSignUpCommand,
    ResendConfirmationCodeCommand,
    ForgotPasswordCommand,
    ConfirmForgotPasswordCommand,
    AuthFlowType,
    GetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { config } from '../config/index';
import { logger } from '../config/logger';
import {
    UnauthorizedError,
    ValidationError,
    ConflictError,
} from '../middleware/errorHandler';
import { UserService, userService } from './UserService';

const cognitoClientConfig: ConstructorParameters<typeof CognitoIdentityProviderClient>[0] = {
    region: config.aws.region,
    credentials: config.aws.accessKeyId && config.aws.secretAccessKey
        ? {
            accessKeyId: config.aws.accessKeyId,
            secretAccessKey: config.aws.secretAccessKey,
        }
        : undefined,
    ...(config.aws.endpointUrl && config.aws.endpointUrl.trim() !== ''
        ? { endpoint: config.aws.endpointUrl }
        : {}),
};

const cognitoClient = new CognitoIdentityProviderClient(cognitoClientConfig);

// Types
export interface RegisterDTO {
    email: string;
    password: string;
}

export interface LoginDTO {
    email: string;
    password: string;
}

export interface ConfirmEmailDTO {
    email: string;
    code: string;
}

export interface ForgotPasswordDTO {
    email: string;
}

export interface ResetPasswordDTO {
    email: string;
    code: string;
    newPassword: string;
}

export interface AuthTokens {
    accessToken: string;
    idToken: string;
    refreshToken: string;
    expiresIn: number;
}

export interface RegisterResponse {
    userSub: string;
    email: string;
    confirmed: boolean;
    message: string;
}

export interface LoginResponse {
    tokens: AuthTokens;
    user: {
        id: string;
        email: string;
        cognitoId: string;
    };
}

export class AuthService {
    private userService: UserService;

    constructor() {
        this.userService = userService;
    }

    /**
     * Register a new user
     */
    async register(data: RegisterDTO): Promise<RegisterResponse> {
        try {
            const command = new SignUpCommand({
                ClientId: config.cognito.clientId,
                Username: data.email.toLowerCase(),
                Password: data.password,
                UserAttributes: [
                    {
                        Name: 'email',
                        Value: data.email.toLowerCase(),
                    },
                ],
            });

            const response = await cognitoClient.send(command);

            logger.info(`User registered: ${data.email}`);

            return {
                userSub: response.UserSub || '',
                email: data.email.toLowerCase(),
                confirmed: response.UserConfirmed || false,
                message: response.UserConfirmed
                    ? 'Registration successful'
                    : 'Registration successful. Please check your email for verification code.',
            };
        } catch (error: unknown) {
            const cognitoError = error as { name?: string; message?: string };
            
            if (cognitoError.name === 'UsernameExistsException') {
                throw new ConflictError('User with this email already exists', 'AUTH_USER_EXISTS');
            }
            if (cognitoError.name === 'InvalidPasswordException') {
                throw new ValidationError(
                    cognitoError.message || 'Password does not meet requirements',
                    'AUTH_INVALID_PASSWORD'
                );
            }
            if (cognitoError.name === 'InvalidParameterException') {
                throw new ValidationError(cognitoError.message || 'Invalid parameters', 'AUTH_INVALID_PARAMS');
            }

            logger.error('Registration error:', {
                error: error instanceof Error ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                } : error,
                context: {
                    email: data.email,
                    operation: 'register',
                },
                timestamp: new Date().toISOString(),
            });
            throw error;
        }
    }

    /**
     * Confirm email with verification code
     */
    async confirmEmail(data: ConfirmEmailDTO): Promise<{ message: string }> {
        try {
            const command = new ConfirmSignUpCommand({
                ClientId: config.cognito.clientId,
                Username: data.email.toLowerCase(),
                ConfirmationCode: data.code,
            });

            await cognitoClient.send(command);

            logger.info(`Email confirmed: ${data.email}`);

            return { message: 'Email verified successfully' };
        } catch (error: unknown) {
            const cognitoError = error as { name?: string; message?: string };
            
            if (cognitoError.name === 'CodeMismatchException') {
                throw new ValidationError('Invalid verification code', 'AUTH_CODE_MISMATCH');
            }
            if (cognitoError.name === 'ExpiredCodeException') {
                throw new ValidationError('Verification code has expired', 'AUTH_CODE_EXPIRED');
            }
            if (cognitoError.name === 'NotAuthorizedException') {
                throw new ValidationError('User is already confirmed', 'AUTH_ALREADY_CONFIRMED');
            }

            logger.error('Email confirmation error:', {
                error: error instanceof Error ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                } : error,
                context: {
                    email: data.email,
                    operation: 'confirmEmail',
                },
                timestamp: new Date().toISOString(),
            });
            throw error;
        }
    }

    /**
     * Resend verification code
     */
    async resendVerificationCode(email: string): Promise<{ message: string }> {
        try {
            const command = new ResendConfirmationCodeCommand({
                ClientId: config.cognito.clientId,
                Username: email.toLowerCase(),
            });

            await cognitoClient.send(command);

            logger.info(`Verification code resent to: ${email}`);

            return { message: 'If the email exists, a verification code has been sent' };
        } catch (error: unknown) {
            const cognitoError = error as { name?: string; message?: string };
            
            if (cognitoError.name === 'UserNotFoundException') {
                // Don't reveal if user exists - return same message as success
                return { message: 'If the email exists, a verification code has been sent' };
            }
            if (cognitoError.name === 'LimitExceededException') {
                throw new ValidationError('Too many attempts. Please try again later.', 'AUTH_RATE_LIMITED');
            }

            logger.error('Resend verification code error:', {
                error: error instanceof Error ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                } : error,
                context: {
                    email: email,
                    operation: 'resendVerificationCode',
                },
                timestamp: new Date().toISOString(),
            });
            throw error;
        }
    }

    /**
     * Login user
     */
    async login(data: LoginDTO): Promise<LoginResponse> {
        try {
            const command = new InitiateAuthCommand({
                ClientId: config.cognito.clientId,
                AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
                AuthParameters: {
                    USERNAME: data.email.toLowerCase(),
                    PASSWORD: data.password,
                },
            });

            const response = await cognitoClient.send(command);

            if (!response.AuthenticationResult) {
                throw new UnauthorizedError('Authentication failed', 'AUTH_FAILED');
            }

            const { AccessToken, IdToken, RefreshToken, ExpiresIn } =
                response.AuthenticationResult;

            if (!AccessToken || !IdToken || !RefreshToken) {
                throw new UnauthorizedError('Incomplete authentication response', 'AUTH_INCOMPLETE');
            }

            const getUserCommand = new GetUserCommand({
                AccessToken,
            });
            const userInfo = await cognitoClient.send(getUserCommand);

            const cognitoId = userInfo.Username || '';
            const email = userInfo.UserAttributes?.find(
                (attr) => attr.Name === 'email'
            )?.Value || data.email.toLowerCase();

            const localUser = await this.userService.findOrCreateFromCognito({
                cognitoId,
                email,
            });

            logger.info(`User logged in: ${email}`);

            return {
                tokens: {
                    accessToken: AccessToken,
                    idToken: IdToken,
                    refreshToken: RefreshToken,
                    expiresIn: ExpiresIn || 3600,
                },
                user: {
                    id: localUser.id,
                    email: localUser.email,
                    cognitoId: localUser.cognitoId,
                },
            };
        } catch (error: unknown) {
            const cognitoError = error as { name?: string; message?: string };
            
            if (cognitoError.name === 'NotAuthorizedException') {
                throw new UnauthorizedError('Invalid email or password', 'AUTH_INVALID_CREDENTIALS');
            }
            if (cognitoError.name === 'UserNotConfirmedException') {
                throw new UnauthorizedError(
                    'Please verify your email before logging in',
                    'AUTH_EMAIL_NOT_VERIFIED'
                );
            }
            if (cognitoError.name === 'UserNotFoundException') {
                throw new UnauthorizedError('Invalid email or password', 'AUTH_INVALID_CREDENTIALS');
            }

            logger.error('Login error:', {
                error: error instanceof Error ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                } : error,
                context: {
                    email: data.email,
                    operation: 'login',
                },
                timestamp: new Date().toISOString(),
            });
            throw error;
        }
    }

    /**
     * Logout user (global sign out - invalidates all tokens)
     */
    async logout(accessToken: string): Promise<{ message: string }> {
        try {
            const command = new GlobalSignOutCommand({
                AccessToken: accessToken,
            });

            await cognitoClient.send(command);

            logger.info('User logged out');

            return { message: 'Logged out successfully' };
        } catch (error: unknown) {
            const cognitoError = error as { name?: string; message?: string };
            
            if (cognitoError.name === 'NotAuthorizedException') {
                // Token already invalid, consider it logged out
                return { message: 'Logged out successfully' };
            }

            logger.error('Logout error:', {
                error: error instanceof Error ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                } : error,
                context: {
                    operation: 'logout',
                },
                timestamp: new Date().toISOString(),
            });
            throw error;
        }
    }

    /**
     * Initiate forgot password flow
     */
    async forgotPassword(data: ForgotPasswordDTO): Promise<{ message: string }> {
        try {
            const command = new ForgotPasswordCommand({
                ClientId: config.cognito.clientId,
                Username: data.email.toLowerCase(),
            });

            await cognitoClient.send(command);

            logger.info(`Password reset initiated for: ${data.email}`);

            return {
                message: 'If the email exists, a password reset code has been sent',
            };
        } catch (error: unknown) {
            const cognitoError = error as { name?: string; message?: string };
            
            if (cognitoError.name === 'UserNotFoundException') {
                return {
                    message: 'If the email exists, a password reset code has been sent',
                };
            }
            if (cognitoError.name === 'LimitExceededException') {
                throw new ValidationError('Too many attempts. Please try again later.', 'AUTH_RATE_LIMITED');
            }

            logger.error('Forgot password error:', {
                error: error instanceof Error ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                } : error,
                context: {
                    email: data.email,
                    operation: 'forgotPassword',
                },
                timestamp: new Date().toISOString(),
            });
            throw error;
        }
    }

    /**
     * Confirm password reset with code
     */
    async resetPassword(data: ResetPasswordDTO): Promise<{ message: string }> {
        try {
            const command = new ConfirmForgotPasswordCommand({
                ClientId: config.cognito.clientId,
                Username: data.email.toLowerCase(),
                ConfirmationCode: data.code,
                Password: data.newPassword,
            });

            await cognitoClient.send(command);

            logger.info(`Password reset completed for: ${data.email}`);

            return { message: 'Password reset successfully' };
        } catch (error: unknown) {
            const cognitoError = error as { name?: string; message?: string };
            
            if (cognitoError.name === 'CodeMismatchException') {
                throw new ValidationError('Invalid reset code', 'AUTH_CODE_MISMATCH');
            }
            if (cognitoError.name === 'ExpiredCodeException') {
                throw new ValidationError('Reset code has expired', 'AUTH_CODE_EXPIRED');
            }
            if (cognitoError.name === 'InvalidPasswordException') {
                throw new ValidationError(
                    cognitoError.message || 'Password does not meet requirements',
                    'AUTH_INVALID_PASSWORD'
                );
            }

            logger.error('Reset password error:', {
                error: error instanceof Error ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                } : error,
                context: {
                    email: data.email,
                    operation: 'resetPassword',
                },
                timestamp: new Date().toISOString(),
            });
            throw error;
        }
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshToken(refreshToken: string): Promise<AuthTokens> {
        try {
            const command = new InitiateAuthCommand({
                ClientId: config.cognito.clientId,
                AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
                AuthParameters: {
                    REFRESH_TOKEN: refreshToken,
                },
            });

            const response = await cognitoClient.send(command);

            if (!response.AuthenticationResult) {
                throw new UnauthorizedError('Token refresh failed', 'AUTH_REFRESH_FAILED');
            }

            const { AccessToken, IdToken, ExpiresIn } = response.AuthenticationResult;

            if (!AccessToken || !IdToken) {
                throw new UnauthorizedError('Incomplete token refresh response', 'AUTH_INCOMPLETE');
            }

            logger.info('Access token refreshed successfully');

            // Note: Cognito doesn't return a new refresh token when using REFRESH_TOKEN_AUTH
            // The original refresh token remains valid
            return {
                accessToken: AccessToken,
                idToken: IdToken,
                refreshToken: refreshToken, // Return the same refresh token
                expiresIn: ExpiresIn || 3600,
            };
        } catch (error: unknown) {
            const cognitoError = error as { name?: string; message?: string };
            
            if (cognitoError.name === 'NotAuthorizedException') {
                throw new UnauthorizedError(
                    'Invalid or expired refresh token. Please login again.',
                    'AUTH_INVALID_REFRESH_TOKEN'
                );
            }

            logger.error('Token refresh error:', {
                error: error instanceof Error ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                } : error,
                context: {
                    operation: 'refreshToken',
                },
                timestamp: new Date().toISOString(),
            });
            throw error;
        }
    }
}

export const authService = new AuthService();
