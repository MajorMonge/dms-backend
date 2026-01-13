import request from 'supertest';
import { Application } from 'express';

export const apiRequest = (app: Application) => request(app);

export const withAuth = (token: string) => ({
    Authorization: `Bearer ${token}`,
});

export const expectSuccess = (response: any) => {
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    return response.body.data;
};

export const expectError = (response: any, code?: string) => {
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
    if (code) {
        expect(response.body.error.code).toBe(code);
    }
    return response.body.error;
};
